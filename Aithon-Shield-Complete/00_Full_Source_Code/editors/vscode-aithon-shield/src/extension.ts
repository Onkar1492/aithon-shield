import * as vscode from "vscode";
import { fetchFindings, patchFindingStatus, scanDetailUrl } from "./api";
import { FindingsTreeProvider, FindingItem, SECRET_KEY } from "./findingsTree";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const getBaseUrl = () =>
    vscode.workspace.getConfiguration("aithonShield").get<string>("baseUrl", "http://127.0.0.1:5001").trim() ||
    "http://127.0.0.1:5001";

  const getApiKey = () => context.secrets.get(SECRET_KEY);

  const loadFindings = async () => {
    const key = await getApiKey();
    if (!key?.trim()) {
      throw new Error("No API key — run “Aithon Shield: Set API Key” (create a key in Settings → API Keys in the web app).");
    }
    return fetchFindings(getBaseUrl(), key.trim());
  };

  const tree = new FindingsTreeProvider(getBaseUrl, loadFindings);
  context.subscriptions.push(vscode.window.registerTreeDataProvider("aithonShieldFindings", tree));

  context.subscriptions.push(
    vscode.commands.registerCommand("aithonShield.setApiKey", async () => {
      const key = await vscode.window.showInputBox({
        title: "Aithon Shield API Key",
        prompt: "Paste an API key (aithon_…) from the web app → Settings → API Keys. Stored in VS Code secret storage.",
        password: true,
        ignoreFocusOut: true,
      });
      if (key?.trim()) {
        await context.secrets.store(SECRET_KEY, key.trim());
        vscode.window.showInformationMessage("Aithon Shield API key saved.");
        await tree.load();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aithonShield.refreshFindings", async () => {
      tree.refresh();
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Loading Aithon Shield findings…",
        },
        async () => {
          await tree.load();
        },
      );
      const key = await getApiKey();
      if (!key) {
        vscode.window.showWarningMessage('Set an API key: command “Aithon Shield: Set API Key”.');
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aithonShield.openInBrowser", async (item: FindingItem) => {
      const f = item?.finding;
      if (!f?.scanType || !f.scanId) {
        vscode.window.showErrorMessage("Finding has no linked scan.");
        return;
      }
      const url = scanDetailUrl(getBaseUrl(), f.scanType, f.scanId);
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aithonShield.markResolved", async (item: FindingItem) => {
      const f = item?.finding;
      if (!f?.id) {
        vscode.window.showErrorMessage("No finding selected.");
        return;
      }
      const key = await getApiKey();
      if (!key?.trim()) {
        vscode.window.showErrorMessage("Set an API key first.");
        return;
      }
      try {
        await patchFindingStatus(getBaseUrl(), key.trim(), f.id, "resolved");
        vscode.window.showInformationMessage(`Marked resolved: ${f.title.slice(0, 80)}`);
        await tree.load();
      } catch (e) {
        vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("aithonShield.baseUrl")) {
        void tree.load();
      }
    }),
  );

  await tree.load();
}

export function deactivate(): void {}
