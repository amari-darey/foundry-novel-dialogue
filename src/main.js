const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;


class NovelDialogue extends HandlebarsApplicationMixin(ApplicationV2) {

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

        this.element.addEventListener("dblclick", () => {
            this.close();
        });
    }
}


class NovelDialogueManager extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: "novel-dialogue-manager",
        position: {
            width: 500,
            height: 600
        }
    };

    static PARTS = {
        main: {
            template: "modules/novel-dialogue/templates/manager.hbs"
        }
    };

    constructor(options = {}) {
        super(options);
        this.images = game.settings.get("novel-dialogue", "images") ?? [];
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.images = this.images;
        return context;
    }

    _onRender(context, options) {
        super._onRender?.(context, options);

        this.element
            .querySelector('[data-action="browse"]')
            ?.addEventListener("click", () => {
                this._browseImage();
            });

        this.element
            .querySelector('[data-action="add"]')
            ?.addEventListener("click", () => {
                this._addImage();
            });

        this.element
            .querySelectorAll(".novel-dialogue-image-button")
            .forEach(button => {
                button.addEventListener("click", () => {
                    this.selectImage(button.dataset.path);
                });
            });
    }

    _browseImage() {
        const pathInput = this.element.querySelector(
            '[name="image-path"]'
        );

        const picker = new FilePicker({
            type: "image",
            current: pathInput.value,
            callback: (path) => {
                pathInput.value = path;
            }
        });

        picker.browse();
    }

    async _addImage() {
        const nameInput = this.element.querySelector(
            '[name="image-name"]'
        );

        const pathInput = this.element.querySelector(
            '[name="image-path"]'
        );

        const name = nameInput.value.trim();
        const path = pathInput.value.trim();

        if (!name) {
            ui.notifications.warn("Введите имя картинки");
            return;
        }

        if (!path) {
            ui.notifications.warn("Выберите картинку");
            return;
        }

        this.images.push({
            name,
            path
        });

        await game.settings.set("novel-dialogue", "images", this.images);

        console.log("[ND] Added image:", {
            name,
            path
        });

        nameInput.value = "";
        pathInput.value = "";

        this.render();
    }

    selectImage(path) {
        console.log("[ND] Sending image:", path);

        game.novelDialogue.imagePath = path;
        game.novelDialogue.render(true);

        game.socket.emit("module.novel-dialogue", {
            action: "showImage",
            path
        });
    }
}


Hooks.once("init", () => {
    game.settings.register("novel-dialogue", "images", {
        name: "Novel Dialogue Images",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });
});


Hooks.once("ready", () => {
    game.novelDialogue = new NovelDialogue();

    game.socket.on("module.novel-dialogue", (data) => {
        console.log("[ND] Socket received:", data);

        if (!data) return;
        if (data.action !== "showImage") return;
        if (!data.path) return;

        game.novelDialogue.imagePath = data.path;
        game.novelDialogue.render(true);

        console.log("[ND] Showing image:", data.path);
    });
});


Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user.isGM) return;

    controls.tokens.tools["novel-dialogue"] = {
        name: "novel-dialogue",
        title: "Novel Dialogue",
        icon: "fas fa-comments",
        button: true,
        onClick: () => {
            new NovelDialogueManager().render(true);
        }
    };
});