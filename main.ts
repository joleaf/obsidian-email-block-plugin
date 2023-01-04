import {Plugin, parseYaml, MarkdownRenderer, Component} from "obsidian";

interface MailBlockParameters {
    to: string | undefined;
    cc: string | undefined;
    bcc: string | undefined;
    subject: string | undefined;
    body: string | undefined; // Future version: can be a note, which will be formatted as html for the body
    showmailto: boolean | undefined;
    variables: { [name: string]: string | undefined }
}

export default class MailBlockPlugin extends Plugin {

    async onload() {
        console.log("email block loading...");

        this.registerMarkdownCodeBlockProcessor("email", async (src, el, ctx) => {
            // Get Parameters
            let parameters: MailBlockParameters | null = null;
            try {
                parameters = this.readParameters(src);
            } catch (e) {
                el.createEl("h3", {text: "Email parameters invalid: \n" + e.message});
                return;
            }

            console.log("Render the Email");
            try {
                const rootEl = el.createEl("div", {cls: "email-block"});
                //rootEl.createEl("a", {text: "Send", href: "mailto:" + parameters.to + "#subject" + parameters.subject})
                if (parameters.to !== undefined) {
                    rootEl.createEl("div", {cls: "email-block-info", text: "To:"});
                    rootEl.createEl("div", {cls: "email-block-info-value", text: this.renderAddress(parameters.to)});
                }
                if (parameters.cc !== undefined) {
                    rootEl.createEl("div", {cls: "email-block-info", text: "Cc:"});
                    rootEl.createEl("div", {cls: "email-block-info-value", text: this.renderAddress(parameters.cc)});
                }
                if (parameters.bcc !== undefined) {
                    rootEl.createEl("div", {cls: "email-block-info", text: "Bcc:"});
                    rootEl.createEl("div", {cls: "email-block-info-value", text: this.renderAddress(parameters.bcc)});
                }
                rootEl.createEl("div", {cls: "email-block-info", text: "Subject:"});
                rootEl.createEl("div", {cls: "email-block-info-value", text: parameters.subject});
                const bodyContent = rootEl.createEl("div", {cls: "email-block-body"});
                await this.renderBody(bodyContent, parameters.body, parameters.variables);
                const data = "mailto:" + this.encodeToHtml(parameters.to) +
                    "?subject=" + this.encodeToHtml(parameters.subject) +
                    "&cc=" + this.encodeToHtml(parameters.cc) +
                    "&bcc=" + this.encodeToHtml(parameters.bcc) +
                    "&body=" + this.encodeToHtml(bodyContent.innerText);
                if (parameters.showmailto) {
                    rootEl.createEl("a", {href: data, text: "Mailto"});
                }
            } catch (error) {
                el.createEl("h3", {text: error});
            }
        });
    }


    private readParameters(jsonString: string) {
        if (jsonString.contains("[[") && !jsonString.contains('"[[')) {
            jsonString = jsonString.replace("[[", '"[[');
            jsonString = jsonString.replace("]]", ']]"');
        }

        const parameters: MailBlockParameters = parseYaml(jsonString);

        parameters.to = this.fixAddress(parameters.to)
        parameters.cc = this.fixAddress(parameters.cc)
        parameters.bcc = this.fixAddress(parameters.bcc)

        if (parameters.subject == undefined) {
            parameters.subject = ""
        }

        if (parameters.showmailto == undefined) {
            parameters.showmailto = true;
        }

        if (parameters.body === undefined) {
            parameters.body = "";
        }

        // Variables
        if (parameters.variables === undefined) {
            parameters.variables = {};
        }
        parameters.variables['filename'] = this.app.workspace.getActiveFile()?.basename
        const frontmatterData = this.app.metadataCache.getFileCache(app.workspace.getActiveFile()!)?.frontmatter
        if (frontmatterData != undefined) {
            for (const [key, value] of Object.entries(frontmatterData)) {
                parameters.variables[key] = value.toString();
            }
        }
        return parameters;
    }

    private fixAddress(address: string | undefined) {
        if (address === undefined) {
            return undefined;
        }
        let fixedAddress = address.replace(/\s/g, "").replace(";", ",");
        return fixedAddress;
    }

    private renderAddress(address: string) {
        return address.split(",").join(", ");
    }

    private async renderBody(bodyContentEl: HTMLElement, bodyContent: string | undefined, variables: { [name: string]: string | undefined }) {
        if (bodyContent === undefined) {
            return;
        }
        // render a markdown file
        if (bodyContent.startsWith("[[")) {
            bodyContent = bodyContent.substring(2, bodyContent.length - 2);

            const mdFile = this.app.metadataCache.getFirstLinkpathDest(
                bodyContent,
                ""
            );
            if (mdFile != null) {
                let mdContent = await this.app.vault.read(mdFile);
                for (const [variable, value] of Object.entries(variables)) {
                    if (value != undefined) {
                        mdContent = mdContent.replace("{{" + variable + "}}", value);
                    }
                }
                await MarkdownRenderer.renderMarkdown(mdContent, bodyContentEl, mdFile.path, new Component());
            }
        } else { // Render line by line as plain text
            for (const [variable, value] of Object.entries(variables)) {
                if (value != undefined) {
                    bodyContent = bodyContent?.replace("{{" + variable + "}}", value);
                }
            }
            let lines = bodyContent.split("\n");
            lines.forEach(line => {
                bodyContentEl.createEl("div", {cls: "email-block-body-line", text: line});
            })
        }
    }

    private encodeToHtml(rawStr: string | undefined) {
        if (rawStr === undefined) {
            return "";
        }
        let retStr = encodeURIComponent(rawStr);
        return retStr;
    }

    onunload() {
        console.log("Unloading email plugin...");
    }
}
