import {Plugin, parseYaml, MarkdownRenderer, Component, MarkdownPostProcessorContext, setIcon} from "obsidian";

interface MailBlockParameters {
    to: string | undefined;
    cc: string | undefined;
    bcc: string | undefined;
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


                if (parameters.from !== undefined) {
                    rootEl.createEl("div", {cls: "email-block-info", text: "From:"});
                    rootEl.createEl("div", {cls: "email-block-info-value", text: this.renderAddress(parameters.from)});
                }
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
                const subjectContent = rootEl.createEl("div", {cls: "email-block-info-value"});
                await this.renderBody(subjectContent, parameters.subject, parameters.variables, ctx);

                const bodyContent = rootEl.createEl("div", {cls: "email-block-body"});
                await this.renderBody(bodyContent, parameters.body, parameters.variables, ctx);
                if (parameters.showmailto) {
                    const data = "mailto:" + this.encodeToHtml(parameters.to) +
                        "?subject=" + this.encodeToHtml(subjectContent.innerText) +
                        (parameters.cc !== undefined ? "&cc=" + this.encodeToHtml(parameters.cc) : "") +
                        (parameters.bcc !== undefined ? "&bcc=" + this.encodeToHtml(parameters.bcc) : "") +
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
                        parameters.variables[key] = value.toString();
                    }
                }
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
        return encodeURIComponent(rawStr);
    }

    onunload() {
        console.log("Unloading email plugin...");
    }
}
