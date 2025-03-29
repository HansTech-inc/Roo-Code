import type { Browser, HTTPRequest, Page } from "puppeteer-core"
import puppeteer from "puppeteer-core"
import type { Cline } from "../Cline"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { ToolUse } from "../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "./types"

interface SearchResult {
  title: string
  url: string
  snippet: string
  relevanceScore: number
  metadata: {
    author?: string
    datePublished?: string
    keywords?: string[]
    description?: string
  }
  content: {
    mainText: string
    codeSnippets: string[]
    headings: string[]
    lists: string[]
  }
  pageStructure: {
    hasNavigation: boolean
    hasFooter: boolean
    hasSidebar: boolean
    sections: string[]
  }
}

type SearchResultBasic = Pick<SearchResult, 'title' | 'url' | 'snippet'>

async function analyzePage(page: Page, url: string): Promise<Partial<SearchResult>> {
  return page.evaluate(() => {
    const getMetadata = () => {
      const author = document.querySelector('meta[name="author"]')?.getAttribute('content')
      const datePublished = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content')
      const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.split(',')
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content')
      
      return { author, datePublished, keywords, description }
    }

    const getContent = () => {
      // Extract main content
      const mainText = document.querySelector('main, article, .content, #content')?.textContent?.trim() || 
                      document.body.textContent?.trim() || ''

      // Extract code snippets
      const codeSnippets = Array.from(document.querySelectorAll('pre, code'))
        .map(el => el.textContent?.trim())
        .filter(Boolean) as string[]

      // Extract headings
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(el => el.textContent?.trim())
        .filter(Boolean) as string[]

      // Extract lists
      const lists = Array.from(document.querySelectorAll('ul, ol'))
        .map(el => el.textContent?.trim())
        .filter(Boolean) as string[]

      return { mainText, codeSnippets, headings, lists }
    }

    const analyzeStructure = () => {
      const hasNavigation = Boolean(document.querySelector('nav, header'))
      const hasFooter = Boolean(document.querySelector('footer'))
      const hasSidebar = Boolean(document.querySelector('aside, .sidebar, #sidebar'))
      const sections = Array.from(document.querySelectorAll('section'))
        .map(el => el.getAttribute('class') || el.getAttribute('id') || 'unnamed-section')

      return { hasNavigation, hasFooter, hasSidebar, sections }
    }

    return {
      metadata: getMetadata(),
      content: getContent(),
      pageStructure: analyzeStructure()
    }
  })
}

async function performBingSearch(query: string, browser: Browser): Promise<SearchResult[]> {
  const page = await browser.newPage()
  
  // Block non-essential resources for faster loading
  await page.setRequestInterception(true)
  page.on('request', (req: HTTPRequest) => {
    if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
      req.abort()
    } else {
      req.continue()
    }
  })

  // Navigate to Bing and perform search
  await page.goto('https://www.bing.com')
  await page.type('input[name="q"]', query)
  await page.keyboard.press('Enter')
  await page.waitForNavigation()

  // Extract search results
  const results = await page.evaluate(() => {
    const searchResults: SearchResultBasic[] = []
    const resultElements = document.querySelectorAll('#b_results .b_algo')
    
    resultElements.forEach((element: Element) => {
      const titleElement = element.querySelector('h2')
      const linkElement = element.querySelector('a')
      const snippetElement = element.querySelector('.b_caption p')

      if (titleElement && linkElement && snippetElement) {
        searchResults.push({
          title: titleElement.textContent || '',
          url: linkElement.getAttribute('href') || '',
          snippet: snippetElement.textContent || '',
        })
      }
    })

    return searchResults
  })

  // Analyze each result page in parallel
  const enrichedResults = await Promise.all(
    results.map(async (result: SearchResultBasic, index: number) => {
      try {
        const resultPage = await browser.newPage()
        await resultPage.setRequestInterception(true)
        resultPage.on('request', (req: HTTPRequest) => {
          if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
            req.abort()
          } else {
            req.continue()
          }
        })

        await resultPage.goto(result.url, { waitUntil: 'domcontentloaded', timeout: 10000 })
        const analysis = await analyzePage(resultPage, result.url)
        await resultPage.close()

        return {
          ...result,
          ...analysis,
          relevanceScore: 1 - (index * 0.1), // Simple relevance scoring based on position
        } as SearchResult
      } catch (error) {
        console.error(`Error analyzing page ${result.url}:`, error)
        return {
          ...result,
          relevanceScore: 1 - (index * 0.1),
          content: { mainText: '', codeSnippets: [], headings: [], lists: [] },
          metadata: {},
          pageStructure: { hasNavigation: false, hasFooter: false, hasSidebar: false, sections: [] }
        } as SearchResult
      }
    })
  )

  await page.close()
  return enrichedResults
}

function generateQueries(baseQuery: string): string[] {
  const queries: string[] = [baseQuery]

  if (baseQuery.toLowerCase().includes("latest") || 
      baseQuery.toLowerCase().includes("recent") || 
      baseQuery.toLowerCase().includes("new")) {
    queries.push(`${baseQuery} last 24 hours`)
    queries.push(`${baseQuery} today`)
  }

  return queries
}

export async function webSearchTool(
  cline: Cline,
  block: ToolUse,
  askApproval: AskApproval,
  handleError: HandleError,
  pushToolResult: PushToolResult,
  removeClosingTag: RemoveClosingTag,
) {
  try {
    const query = block.params.query
    if (!query) {
      cline.consecutiveMistakeCount++
      pushToolResult(await cline.sayAndCreateMissingParamError("web_search", "query"))
      return
    }

    const sharedMessageProps: ClineSayTool = {
      tool: "web_search",
      content: `Searching for: ${removeClosingTag("query", query)}`,
    }

    if (block.partial) {
      const partialMessage = JSON.stringify({
        ...sharedMessageProps,
        content: undefined,
      } satisfies ClineSayTool)
      await cline.ask("tool", partialMessage, block.partial).catch(() => {})
      return
    }

    // Get user approval
    const completeMessage = JSON.stringify(sharedMessageProps)
    const didApprove = await askApproval("tool", completeMessage)
    if (!didApprove) {
      return
    }

    // Launch browser using puppeteer-core
    const browser = await puppeteer.launch({ 
      headless: 'new'
    })

    try {
      // Generate search queries
      const queries = generateQueries(query)
      
      // Perform searches in parallel
      const searchPromises = queries.map(q => performBingSearch(q, browser))
      const searchResults = await Promise.all(searchPromises)
      
      // Combine and deduplicate results
      const seenUrls = new Set<string>()
      const combinedResults = searchResults
        .flat()
        .filter(result => {
          if (seenUrls.has(result.url)) {
            return false
          }
          seenUrls.add(result.url)
          return true
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5) // Return top 5 results

      // Format results for output
      const formattedResults = combinedResults.map((result, index) => {
        const metadata = result.metadata?.description ? 
          `\n   Description: ${result.metadata.description}` : ''
        const codeSnippets = result.content?.codeSnippets?.length ?
          `\n   Code Examples: ${result.content.codeSnippets.length} found` : ''
        const topics = result.content?.headings?.length ?
          `\n   Main Topics: ${result.content.headings.slice(0, 3).join(', ')}` : ''
          
        return `${index + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.snippet}${metadata}${codeSnippets}${topics}\n`
      }).join('\n')

      cline.consecutiveMistakeCount = 0
      pushToolResult(`Search Results for "${query}":\n\n${formattedResults}`)

    } finally {
      await browser.close()
    }

  } catch (error) {
    await handleError("web searching", error)
  }
}