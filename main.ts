import {Plugin, parseYaml, MarkdownRenderer, Component, MarkdownPostProcessorContext, setIcon} from "obsidian";

interface MailBlockParameters {
    to: [string] | string | undefined;
    cc: [string] | string | undefined;
    bcc: [string] | string | undefined;
    subject: string | undefined;
    body: string | undefined;
    showmailto: boolean | undefined;
    variables: { [name: string]: string | undefined }
    from: string | undefined;
}

export default class MailBlockPlugin extends Plugin {

    async onload() {
        console.log("email block loading...");

        this.registerMarkdownCodeBlockProcessor("email", async (src, el, ctx) => {
            // Get Parameters
            let parameters: MailBlockParameters | null = null;
            try {
                parameters = this.readParameters(src, ctx);
            } catch (e) {
                el.createEl("h3", {text: "Email parameters invalid: \n" + e.message});
                return;
            }

            // console.log("Render the Email " + parameters);
            try {
                const rootEl = el.createEl("div", {cls: "email-block email-block-border"});

                let fromContent = undefined;
                if (parameters.from !== undefined) {
                    rootEl.createEl("div", {cls: "email-block-info", text: "From:"});
                    fromContent = this.replaceVariables(this.renderAddress(parameters.from), parameters.variables)
                    rootEl.createEl("div", {cls: "email-block-info-value", text: fromContent});
                }
                let toContent = undefined;
                if (parameters.to !== undefined) {
                    rootEl.createEl("div", {cls: "email-block-info", text: "To:"});
                    toContent = this.replaceVariables(this.renderAddress(parameters.to), parameters.variables)
                    rootEl.createEl("div", {cls: "email-block-info-value", text: toContent});
                }
                let ccContent = undefined;
                if (parameters.cc !== undefined) {
                    rootEl.createEl("div", {cls: "email-block-info", text: "Cc:"});
                    ccContent = this.replaceVariables(this.renderAddress(parameters.cc), parameters.variables)
                    rootEl.createEl("div", {cls: "email-block-info-value", text: ccContent});
                }
                let bccContent = undefined;
                if (parameters.bcc !== undefined) {
                    rootEl.createEl("div", {cls: "email-block-info", text: "Bcc:"});
                    bccContent = this.replaceVariables(this.renderAddress(parameters.bcc), parameters.variables)
                    rootEl.createEl("div", {cls: "email-block-info-value", text: bccContent});
                }
                rootEl.createEl("div", {cls: "email-block-info", text: "Subject:"});
                const subjectContent = this.replaceVariables(parameters.subject, parameters.variables);
                rootEl.createEl("div", {cls: "email-block-info-value", text: subjectContent});

                const bodyContent = rootEl.createEl("div", {cls: "email-block-body"});
                await this.renderBody(bodyContent, parameters.body, parameters.variables, ctx);
                if (parameters.showmailto) {
                    const data = "mailto:" + this.encodeToHtml(toContent) +
                        "?subject=" + this.encodeToHtml(subjectContent) +
                        (ccContent !== undefined ? "&cc=" + this.encodeToHtml(ccContent) : "") +
                        (bccContent !== undefined ? "&bcc=" + this.encodeToHtml(bccContent) : "") +
                        (bodyContent.innerText.length !== 0 ? "&body=" + this.encodeToHtml(bodyContent.innerText) : "");
                    const mailToButton = rootEl
                        .createEl("div", {cls: "email-block-mailto"})
                        .createEl("a", {href: data, text: "Mailto"});
                    setIcon(mailToButton, "mail");
                }

            } catch (error) {
                el.createEl("h3", {text: error});
            }
        });
    }


    private readParameters(yamlString: string, ctx: MarkdownPostProcessorContext) {
        if (yamlString.contains("[[") && !yamlString.contains('"[[')) {
            yamlString = yamlString.replace("[[", '"[[');
            yamlString = yamlString.replace("]]", ']]"');
        }
        let extraBody = "";
        if (yamlString.contains("---")) {
            let data = yamlString.split("---");
            yamlString = data[0];
            extraBody = data[1];
        }

        //Necessary to do not parse {{value}} into on object by parseYaml
        if (yamlString.contains("{{") && !yamlString.contains('"{{')) {
            yamlString = yamlString.replace("{{", '"{{');
            yamlString = yamlString.replace("}}", '}}"');
        }

        const parameters: MailBlockParameters = parseYaml(yamlString);

        parameters.to = this.fixAddress(parameters.to);
        parameters.cc = this.fixAddress(parameters.cc);
        parameters.bcc = this.fixAddress(parameters.bcc);

        if (parameters.subject == undefined) {
            parameters.subject = "";
        } else {
            //remove double quotes (it has been utilized after parsing)
            parameters.subject = parameters.subject.replace('"{{', "{{");
            parameters.subject = parameters.subject.replace('}}"', "}}");
        }

        if (parameters.showmailto == undefined) {
            parameters.showmailto = true;
        }

        if (parameters.body === undefined) {
            parameters.body = extraBody;
        }

        // Variables
        if (parameters.variables === undefined) {
            parameters.variables = {};
        }
        const sourceFile = this.app.metadataCache.getFirstLinkpathDest(
            ctx.sourcePath,
            "",
        );
        if (sourceFile != null) {
            const sourceCache = this.app.metadataCache.getFileCache(sourceFile);
            if (sourceCache != null) {
                if (sourceCache.frontmatter != undefined) {
                    for (const [key, value] of Object.entries(sourceCache.frontmatter)) {
                        if (value && typeof value.toString === 'function') {
                            parameters.variables[key] = value.toString();
                        }
                    }
                }
            }
        }
        return parameters;
    }

    private fixAddress(address: [string] | string | undefined) {
        if (address === undefined) {
            return undefined;
        }
        let fixedAddress: string = "";
        if (Array.isArray(address)) {
            fixedAddress = address.join(",");
        } else {
            fixedAddress = address;
        }
        fixedAddress = fixedAddress.replace(/\s/g, "").replace(";", ",");
        return fixedAddress;
    }

    private renderAddress(address: [string] | string) {
        if (Array.isArray(address)) {
            return address.join(", ")
        }
        return address.split(",").join(", ");
    }

    private async renderBody(bodyContentEl: HTMLElement, bodyContent: string | undefined, variables: {
        [name: string]: string | undefined
    }, ctx: MarkdownPostProcessorContext) {
        if (bodyContent === undefined) {
            return;
        }
// render a markdown file
        if (bodyContent.startsWith("[[")) {
            bodyContent = bodyContent.substring(2, bodyContent.length - 2);

            const mdFile = this.app.metadataCache.getFirstLinkpathDest(
                bodyContent,
                ctx.sourcePath
            );
            if (mdFile != null) {
                let mdContent = await this.app.vault.read(mdFile);
                mdContent = this.replaceVariables(mdContent, variables);
                await MarkdownRenderer.renderMarkdown(mdContent, bodyContentEl, mdFile.path, new Component());
            }
        } else { // Render line by line as plain text
            bodyContent = this.replaceVariables(bodyContent, variables);
            let lines = bodyContent.split("\n");
            lines.forEach(line => {
                bodyContentEl.createEl("div", {cls: "email-block-body-line", text: line});
            })
        }
    }

    private replaceVariables(content: string | undefined, variables: { [name: string]: string | undefined }): string {
        if (content === undefined) {
            return "";
        }
        let resultingContent = content;
        for (const [variable, value] of Object.entries(variables)) {
            if (value != undefined) {
                resultingContent = resultingContent?.replace("{{" + variable + "}}", value);
            }
        }
        return resultingContent;
    }

    private encodeToHtml(rawStr: string | undefined) {
        if (rawStr === undefined) {
            return "";
        }
        return encodeURIComponent(rawStr);
    }

    onunload() {
        console.log("Unloading email plugin...");
    }
}
