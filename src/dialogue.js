const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class NovelDialogue extends HandlebarsApplicationMixin(ApplicationV2) {
    imagePath = null;

    static DEFAULT_OPTIONS = {
        id: "novel-dialogue",
        position: {
            width: window.innerWidth * 0.5,
            height: window.innerHeight * 0.8,
            left: 0,
            top: window.innerHeight * 0.2
        }
    };

    static PARTS = {
        main: {
            template: "modules/novel-dialogue/templates/dialogue.hbs"
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.imagePath = this.imagePath;
        return context;
    }

    _onRender(context, options) {
        super._onRender?.(context, options);
        this.element.addEventListener("dblclick", () => this.close());
    }
}