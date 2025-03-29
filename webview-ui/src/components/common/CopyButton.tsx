import { memo, useState } from 'react'
import styled from 'styled-components'

interface CopyButtonProps {
  content: string
  className?: string
}

interface StyledButtonProps {
  theme?: Record<string, unknown>
}

interface SVGIconProps {
  className?: string
}

const StyledButton = styled.button<StyledButtonProps>`
  position: absolute;
  top: 8px;
  right: 8px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    background-color: var(--vscode-button-hoverBackground);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`

const CopyIcon = memo<SVGIconProps>(() => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor"
    aria-hidden="true"
    role="img"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={2} 
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" 
    />
  </svg>
))

const CheckIcon = memo<SVGIconProps>(() => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor"
    aria-hidden="true"
    role="img"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={2} 
      d="M5 13l4 4L19 7" 
    />
  </svg>
))

const CopyButton = memo(({ content, className }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  return (
    <StyledButton 
      onClick={handleCopy} 
      className={className} 
      title="Copy to clipboard"
      type="button"
      aria-label={copied ? "Copied!" : "Copy code"}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied!' : 'Copy'}
    </StyledButton>
  )
})

CopyIcon.displayName = 'CopyIcon'
CheckIcon.displayName = 'CheckIcon'
CopyButton.displayName = 'CopyButton'

export default CopyButton