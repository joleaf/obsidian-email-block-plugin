import {Plugin} from "obsidian";
import YAML from 'yaml'

interface MailBlockParameters {
    to: string | undefined;
    cc: string | undefined;
    bcc: string | undefined;
    subject: string | undefined;
    body: string | undefined; // Future version: can be a note, which will be formatted as html for the body
    showmailto: boolean | undefined;
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
                this.renderBody(bodyContent, parameters.body);
                const data = "mailto:" + this.encodeToHtml(parameters.to) +
                    "?subject=" + this.encodeToHtml(parameters.subject) +
                    "&cc=" + this.encodeToHtml(parameters.cc) +
                    "&bcc=" + this.encodeToHtml(parameters.bcc) +
                    "&body=" + this.encodeToHtml(parameters.body);
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

        const parameters: MailBlockParameters = YAML.parse(jsonString);

        parameters.to = this.fixAddress(parameters.to)
        parameters.cc = this.fixAddress(parameters.cc)
        parameters.bcc = this.fixAddress(parameters.bcc)

        if (parameters.subject == undefined) {
            parameters.subject = ""
        }

        if (parameters.showmailto == undefined) {
            parameters.showmailto = true;
        }

        //Transform internal Link to external
        if (parameters.body === undefined) {
            parameters.body = "";
        } else if (parameters.body.startsWith("[[")) {
            parameters.body = parameters.body.substring(2, parameters.body.length - 2);
            // @ts-ignore
            parameters.url = this.app.metadataCache.getFirstLinkpathDest(
                parameters.body,
                ""
            ).path;
            // TODO: for future version: transform content to html!
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

    private renderBody(bodyContentEl: HTMLElement, bodyContent: string | undefined) {
        if (bodyContent === undefined) {
            return;
        }
        let lines = bodyContent.split("\n");
        lines.forEach(line => {
            bodyContentEl.createEl("div", {cls: "email-block-body-line", text: line});
        })
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
