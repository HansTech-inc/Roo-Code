declare module 'react' {
  import * as React from '@types/react'
  
  export type ReactNode = React.ReactNode
  export const memo: typeof React.memo
  export const useState: typeof React.useState
  export const useEffect: typeof React.useEffect
  export const useCallback: typeof React.useCallback
  export const useMemo: typeof React.useMemo
  export default React
}

declare module 'react-remark' {
  import { ReactNode } from 'react'
  export function useRemark(options?: any): [ReactNode, (source: string) => void]
}

declare module 'rehype-highlight' {
  interface Options {
    languages?: Record<string, any>
  }
  export default function rehypeHighlight(options?: Options): any
  export { Options }
}

declare module 'styled-components' {
  import * as CSS from 'csstype'
  import * as React from 'react'

  export interface ThemedStyledComponentsModule<T> {
    createGlobalStyle(
      strings: TemplateStringsArray,
      ...interpolations: SimpleInterpolation[]
    ): GlobalStyleComponent<{}, T>
    css(
      strings: TemplateStringsArray,
      ...interpolations: SimpleInterpolation[]
    ): FlattenInterpolation<ThemeProps<T>>
    keyframes(
      strings: TemplateStringsArray,
      ...interpolations: SimpleInterpolation[]
    ): Keyframes
    ThemeProvider: React.ComponentClass<ThemeProviderProps<T>>
    withTheme: WithThemeFn<T>
    ThemeContext: React.Context<T>
  }

  export type ThemedStyledComponents<T> = ThemedStyledComponentsModule<T>

  export * from '@types/styled-components'
  export default styled
}

declare module 'unist' {
  export interface Node {
    type: string
    [key: string]: any
  }
}

declare module 'unist-util-visit' {
  import { Node } from 'unist'
  export function visit(
    tree: Node,
    test: string | ((node: Node, index?: number, parent?: Node) => boolean),
    visitor: (node: Node, index?: number, parent?: Node) => void,
  ): void
}

declare module 'react/jsx-runtime' {
  export * from '@types/react/jsx-runtime'
}