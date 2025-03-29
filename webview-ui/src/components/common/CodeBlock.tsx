import { memo, useEffect } from "react"
import type { ReactNode } from "react"
import { useRemark } from "react-remark"
import rehypeHighlight, { Options } from "rehype-highlight"
import styled from "styled-components"
import type { Node } from "unist"
import { visit } from "unist-util-visit"
import { useExtensionState } from "../../context/ExtensionStateContext"
import CopyButton from "./CopyButton"

export const CODE_BLOCK_BG_COLOR = "var(--vscode-editor-background, --vscode-sideBar-background, rgb(30 30 30))"

interface StyledMarkdownProps {
  forceWrap: boolean
  theme?: Record<string, unknown>
}

interface StyledPreProps {
  theme: Record<string, string>
}

interface TreeNode extends Node {
  lang?: string
  value?: string
}

const StyledCodeWrapper = styled.div`
  position: relative;
  
  &:hover .code-copy-button {
    opacity: 1;
  }
`

const StyledMarkdown = styled.div<StyledMarkdownProps>`
  ${({ forceWrap }) =>
    forceWrap &&
    `
    pre, code {
      white-space: pre-wrap;
      word-break: break-all;
      overflow-wrap: anywhere;
    }
  `}

  pre {
    background-color: ${CODE_BLOCK_BG_COLOR};
    border-radius: 5px;
    margin: 0;
    min-width: ${({ forceWrap }) => (forceWrap ? "auto" : "max-content")};
    padding: 10px 10px;
  }

  pre > code {
    .hljs-deletion {
      background-color: var(--vscode-diffEditor-removedTextBackground);
      display: inline-block;
      width: 100%;
    }
    .hljs-addition {
      background-color: var(--vscode-diffEditor-insertedTextBackground);
      display: inline-block;
      width: 100%;
    }
  }

  code {
    span.line:empty {
      display: none;
    }
    word-wrap: break-word;
    border-radius: 5px;
    background-color: ${CODE_BLOCK_BG_COLOR};
    font-size: var(--vscode-editor-font-size, var(--vscode-font-size, 12px));
    font-family: var(--vscode-editor-font-family);
  }

  code:not(pre > code) {
    font-family: var(--vscode-editor-font-family);
    color: #f78383;
  }

  background-color: ${CODE_BLOCK_BG_COLOR};
  font-family:
    var(--vscode-font-family),
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    "Open Sans",
    "Helvetica Neue",
    sans-serif;
  font-size: var(--vscode-editor-font-size, var(--vscode-font-size, 12px));
  color: var(--vscode-editor-foreground, #fff);

  p,
  li,
  ol,
  ul {
    line-height: 1.5;
  }
`

const StyledPre = styled.pre<StyledPreProps>`
  & .hljs {
    color: var(--vscode-editor-foreground, #fff);
  }

  ${(props) =>
    Object.keys(props.theme)
      .map((key) => {
        return `
      & ${key} {
        color: ${props.theme[key]};
      }
    `
      })
      .join("")}
`

interface CodeBlockProps {
  source?: string
  forceWrap?: boolean
}

interface PreProps {
  node?: Node
  children?: ReactNode
  theme: Record<string, string>
}

const CodeBlock = memo(({ source, forceWrap = false }: CodeBlockProps) => {
  const { theme } = useExtensionState()
  const [reactContent, setMarkdownSource] = useRemark({
    remarkPlugins: [
      () => {
        return (tree: Node) => {
          visit(tree, "code", (node: TreeNode) => {
            if (!node.lang) {
              node.lang = "javascript"
            } else if (node.lang.includes(".")) {
              // if the language is a file, get the extension
              node.lang = node.lang.split(".").slice(-1)[0]
            }
          })
        }
      },
    ],
    rehypePlugins: [
      rehypeHighlight as any,
      {
        // languages: {},
      } as Options,
    ],
    rehypeReactOptions: {
      components: {
        pre: ({ node, children, ...preProps }: PreProps) => (
          <StyledPre {...preProps} theme={theme} />
        ),
      },
    },
  })

  useEffect(() => {
    setMarkdownSource(source || "")
  }, [source, setMarkdownSource, theme])

  return (
    <div
      style={{
        overflowY: forceWrap ? "visible" : "auto",
        maxHeight: forceWrap ? "none" : "100%",
        backgroundColor: CODE_BLOCK_BG_COLOR,
      }}>
      <StyledCodeWrapper>
        <CopyButton 
          content={source || ""} 
          className="code-copy-button"
        />
        <StyledMarkdown forceWrap={forceWrap}>{reactContent}</StyledMarkdown>
      </StyledCodeWrapper>
    </div>
  )
})

export default CodeBlock
