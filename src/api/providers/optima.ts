import { Anthropic } from "@anthropic-ai/sdk"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { SingleCompletionHandler } from "../"
import { ApiHandlerOptions, geminiDefaultModelId, GeminiModelId, geminiModels, ModelInfo } from "../../shared/api"
import { convertAnthropicMessageToGemini } from "../transform/gemini-format"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"

const PRIMARY_API_KEY = "AIzaSyDSt3zLmaZtmJWnq8z21VFOPUpCYe_A6qA"
const BACKUP_API_KEY = "AIzaSyC77P7YZBOg7da3fIbQWrd2uat4UWKclVc"
const CHUNK_SIZE = 100_000 // Size of sliding window chunks
const OVERLAP = 10_000 // Overlap between chunks to maintain context

export class OptimaHandler extends BaseProvider implements SingleCompletionHandler {
  private primaryClient: GoogleGenerativeAI
  private backupClient: GoogleGenerativeAI
  private lastSuccessfulClient: GoogleGenerativeAI

  constructor(options: ApiHandlerOptions) {
    super()
    this.primaryClient = new GoogleGenerativeAI(PRIMARY_API_KEY)
    this.backupClient = new GoogleGenerativeAI(BACKUP_API_KEY)
    this.lastSuccessfulClient = this.primaryClient
  }

  private async withFailover<T>(operation: (client: GoogleGenerativeAI) => Promise<T>): Promise<T> {
    try {
      const result = await operation(this.lastSuccessfulClient)
      return result
    } catch (error) {
      // If primary client failed, try backup
      const nextClient = this.lastSuccessfulClient === this.primaryClient ? this.backupClient : this.primaryClient
      try {
        const result = await operation(nextClient)
        this.lastSuccessfulClient = nextClient // Update last successful client
        return result
      } catch (fallbackError) {
        throw fallbackError // If both fail, throw the last error
      }
    }
  }

  private async processWithSlidingWindow(content: string, client: GoogleGenerativeAI): Promise<string> {
    const model = client.getGenerativeModel({
      model: "gemma-3-27b-it",
    })

    if (content.length <= CHUNK_SIZE) {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: content }] }],
      })
      return result.response.text()
    }

    let chunks = []
    let position = 0
    let combinedResponse = ""

    while (position < content.length) {
      const chunkEnd = Math.min(position + CHUNK_SIZE, content.length)
      const chunk = content.slice(position, chunkEnd)

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: chunk }] }],
      })

      chunks.push(result.response.text())
      position += CHUNK_SIZE - OVERLAP
    }

    // Combine chunks with context awareness
    combinedResponse = chunks.join(" ")
    return combinedResponse
  }

  override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
    try {
      // Convert messages to text for sliding window processing
      const combinedContent = messages.map(msg => {
        if (typeof msg.content === "string") return msg.content
        return JSON.stringify(msg.content)
      }).join("\n")

      const response = await this.withFailover(async (client) => {
        return await this.processWithSlidingWindow(combinedContent, client)
      })

      // Yield the processed response
      yield {
        type: "text",
        text: response,
      }

      // Approximate token counts for usage metrics
      const inputTokens = Math.ceil(combinedContent.length / 4)
      const outputTokens = Math.ceil(response.length / 4)

      yield {
        type: "usage",
        inputTokens,
        outputTokens,
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Optima AI message error: ${error.message}`)
      }
      throw error
    }
  }

  override getModel(): { id: GeminiModelId; info: ModelInfo } {
    return {
      id: geminiDefaultModelId,
      info: geminiModels[geminiDefaultModelId]
    }
  }

  async completePrompt(prompt: string): Promise<string> {
    try {
      return await this.withFailover(async (client) => {
        return await this.processWithSlidingWindow(prompt, client)
      })
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Optima AI completion error: ${error.message}`)
      }
      throw error
    }
  }
}