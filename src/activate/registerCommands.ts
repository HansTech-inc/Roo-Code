import * as vscode from "vscode"
import delay from "delay"

import { ClineProvider } from "../core/webview/ClineProvider"

import { registerHumanRelayCallback, unregisterHumanRelayCallback, handleHumanRelayResponse } from "./humanRelay"
import { handleNewTask } from "./handleTask"

// Store panel references in both modes
let sidebarPanel: vscode.WebviewView | undefined = undefined
let tabPanel: vscode.WebviewPanel | undefined = undefined

/**
 * Get the currently active panel
 * @returns WebviewPanel或WebviewView
 */
export function getPanel(): vscode.WebviewPanel | vscode.WebviewView | undefined {
	return tabPanel || sidebarPanel
}

/**
 * Set panel references
 */
export function setPanel(
	newPanel: vscode.WebviewPanel | vscode.WebviewView | undefined,
	type: "sidebar" | "tab",
): void {
	if (type === "sidebar") {
		sidebarPanel = newPanel as vscode.WebviewView
		tabPanel = undefined
	} else {
		tabPanel = newPanel as vscode.WebviewPanel
		sidebarPanel = undefined
	}
}

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: ClineProvider
}

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context, outputChannel } = options

	for (const [command, callback] of Object.entries(getCommandsMap(options))) {
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

const getCommandsMap = ({ context, outputChannel, provider }: RegisterCommandOptions) => {
	return {
		"optima-ai.plusButtonClicked": async () => {
			await provider.removeClineFromStack()
			await provider.postStateToWebview()
			await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		},
		"optima-ai.mcpButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
		},
		"optima-ai.promptsButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
		},
"optima-ai.popoutButtonClicked": () => openClineInNewTab({ context, outputChannel }),
"optima-ai.openInNewTab": () => openClineInNewTab({ context, outputChannel }),
"optima-ai.settingsButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		},
		"optima-ai.historyButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
		},
"optima-ai.helpButtonClicked": () => {
vscode.env.openExternal(vscode.Uri.parse("https://github.com/HansTech-inc/Roo-Code"))
		},
		"optima-ai.showHumanRelayDialog": (params: { requestId: string; promptText: string }) => {
			const panel = getPanel()

			if (panel) {
				panel?.webview.postMessage({
					type: "showHumanRelayDialog",
					requestId: params.requestId,
					promptText: params.promptText,
				})
			}
		},
"optima-ai.registerHumanRelayCallback": registerHumanRelayCallback,
"optima-ai.unregisterHumanRelayCallback": unregisterHumanRelayCallback,
"optima-ai.handleHumanRelayResponse": handleHumanRelayResponse,
"optima-ai.newTask": handleNewTask,
"optima-ai.explainCode": () => {
provider.postMessageToWebview({ type: "action", action: "explainCode" })
},
"optima-ai.fixCode": () => {
provider.postMessageToWebview({ type: "action", action: "fixCode" })
},
"optima-ai.improveCode": () => {
provider.postMessageToWebview({ type: "action", action: "improveCode" })
},
"optima-ai.addToContext": () => {
provider.postMessageToWebview({ type: "action", action: "addToContext" })
},
"optima-ai.terminalAddToContext": () => {
provider.postMessageToWebview({ type: "action", action: "terminalAddToContext" })
},
"optima-ai.terminalFixCommand": () => {
provider.postMessageToWebview({ type: "action", action: "terminalFixCommand" })
},
"optima-ai.terminalExplainCommand": () => {
provider.postMessageToWebview({ type: "action", action: "terminalExplainCommand" })
},
"optima-ai.terminalFixCommandInCurrentTask": () => {
provider.postMessageToWebview({ type: "action", action: "terminalFixCommandInCurrentTask" })
},
"optima-ai.terminalExplainCommandInCurrentTask": () => {
provider.postMessageToWebview({ type: "action", action: "terminalExplainCommandInCurrentTask" })
},
"optima-ai.setCustomStoragePath": async () => {
			const { promptForCustomStoragePath } = await import("../shared/storagePathManager")
			await promptForCustomStoragePath()
		},
	}
}

const openClineInNewTab = async ({ context, outputChannel }: Omit<RegisterCommandOptions, "provider">) => {
	// (This example uses webviewProvider activation event which is necessary to
	// deserialize cached webview, but since we use retainContextWhenHidden, we
	// don't need to use that event).
	// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	const tabProvider = new ClineProvider(context, outputChannel, "editor");
	const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor: vscode.TextEditor) => editor.viewColumn || 0))

	// Check if there are any visible text editors, otherwise open a new group
	// to the right.
	const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0

	if (!hasVisibleEditors) {
		await vscode.commands.executeCommand("workbench.action.newGroupRight")
	}

	const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

	const newPanel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "Optima AI", targetCol, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [context.extensionUri],
	})

	// Save as tab type panel.
	setPanel(newPanel, "tab")

	// TODO: Use better svg icon with light and dark variants (see
	// https://stackoverflow.com/questions/58365687/vscode-extension-iconpath).
newPanel.iconPath = vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "icon.svg")

	await tabProvider.resolveWebviewView(newPanel)

	// Handle panel closing events.
	newPanel.onDidDispose(() => {
		setPanel(undefined, "tab")
	})

	// Lock the editor group so clicking on files doesn't open them over the panel.
	await delay(100)
	await vscode.commands.executeCommand("workbench.action.lockEditorGroup")
}
