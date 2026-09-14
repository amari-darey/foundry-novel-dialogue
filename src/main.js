const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ContextMenu } = foundry.applications.ux;

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

        this.images = game.settings.get("novel-dialogue", "images") ?? {};
        this.currentPath = [];
        this.selectedImagePath = "";

        this.contextMenu = new ContextMenu(
            document.body,
            "#novel-dialogue-manager .novel-manager-image, #novel-dialogue-manager .novel-manager-folder",
            [
                {
                    name: "Переименовать",
                    icon: '<i class="fas fa-pencil"></i>',
                    callback: element => {
                        this._renameItem(element.dataset.name);
                    }
                },
                {
                    name: "Изменить изображение",
                    icon: '<i class="fas fa-image"></i>',
                    condition: element => element.classList.contains("novel-manager-image"),
                    callback: element => {
                        this._changeImage(element.dataset.name);
                    }
                },
                {
                    name: "Удалить",
                    icon: '<i class="fas fa-trash"></i>',
                    callback: element => {
                        this._deleteItem(element.dataset.name);
                    }
                }
            ],
            {
                fixed: true,
                jQuery: false
            }
        );
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const folder = this._getCurrentFolder();

        context.items = Object.entries(folder)
            .map(([name, value]) => {
                if (typeof value === "string") {
                    return {
                        isImage: true,
                        name,
                        path: value
                    };
                }

                if (value && typeof value === "object") {
                    return {
                        isFolder: true,
                        name
                    };
                }

                return null;
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return 0;
            });

        context.breadcrumbs = this.currentPath.map((name, index) => ({
            name,
            index
        }));

        context.canGoBack = this.currentPath.length > 0;

        return context;
    }

    _getCurrentFolder() {
        let folder = this.images;

        for (const name of this.currentPath) {
            folder = folder[name];

            if (!folder || typeof folder !== "object") {
                return this.images;
            }
        }

        return folder;
    }

    _onRender(context, options) {
        super._onRender?.(context, options);

        this.element.querySelector("#novel-manager-add-image")?.addEventListener("click", () => {
            this._addImage();
        });

        this.element.querySelector("#novel-manager-add-folder")?.addEventListener("click", () => {
            this._addFolder();
        });

        this.element.querySelector("#novel-manager-back")?.addEventListener("click", () => {
            this._goBack();
        });

        this.element.querySelectorAll(".novel-manager-folder").forEach(element => {
            element.addEventListener("dblclick", () => {
                this._openFolder(element.dataset.name);
            });
        });

        this.element.querySelectorAll(".novel-manager-image").forEach(element => {
            element.addEventListener("dblclick", () => {
                this.selectImage(element.dataset.path);
            });
        });
    }

    _openFolder(name) {
        const folder = this._getCurrentFolder()[name];

        if (!folder || typeof folder !== "object") {
            return;
        }

        this.currentPath.push(name);
        this.render();
    }

    _goBack() {
        if (!this.currentPath.length) {
            return;
        }

        this.currentPath.pop();
        this.render();
    }

    async _addFolder() {
        const folderName = await DialogV2.prompt({
            window: {
                title: "Новая папка"
            },
            content: '<input type="text" name="name" value="">',
            ok: {
                label: "Добавить",
                callback: (event, button) => {
                    return button.form.elements.name.value.trim();
                }
            },
            cancel: {
                label: "Отмена"
            }
        });

        if (!folderName) {
            return;
        }

        const currentFolder = this._getCurrentFolder();

        if (Object.hasOwn(currentFolder, folderName)) {
            ui.notifications.warn(`"${folderName}" уже существует`);
            return;
        }

        currentFolder[folderName] = {};

        await this._saveImages();

        this.render();
    }

    async _addImage() {
        const nameInput = this.element.querySelector('[name="image-name"]');
        const name = nameInput.value.trim();

        if (!name) {
            ui.notifications.warn("Введите имя картинки");
            return;
        }

        const currentFolder = this._getCurrentFolder();

        if (Object.hasOwn(currentFolder, name)) {
            ui.notifications.warn(`"${name}" уже существует`);
            return;
        }

        new FilePicker({
            type: "image",
            callback: async path => {
                currentFolder[name] = path;

                await this._saveImages();

                nameInput.value = "";

                this.render();
            }
        }).browse();
    }

    async _renameItem(oldName) {
        const currentFolder = this._getCurrentFolder();

        if (!Object.hasOwn(currentFolder, oldName)) {
            return;
        }

        const newName = await DialogV2.prompt({
            window: {
                title: "Переименовать"
            },
            content: `<input type="text" name="name" value="${foundry.utils.escapeHTML(oldName)}">`,
            ok: {
                label: "Сохранить",
                callback: (event, button) => {
                    return button.form.elements.name.value.trim();
                }
            },
            cancel: {
                label: "Отмена"
            }
        });

        if (!newName || newName === oldName) {
            return;
        }

        if (Object.hasOwn(currentFolder, newName)) {
            ui.notifications.warn(`"${newName}" уже существует`);
            return;
        }

        currentFolder[newName] = currentFolder[oldName];
        delete currentFolder[oldName];

        await this._saveImages();

        this.render();
    }

    _changeImage(name) {
        const currentFolder = this._getCurrentFolder();
        const currentPath = currentFolder[name];

        if (typeof currentPath !== "string") {
            return;
        }

        const picker = new FilePicker({
            type: "image",
            current: currentPath,
            callback: async path => {
                currentFolder[name] = path;

                await this._saveImages();

                this.render();
            }
        });

        picker.browse();
    }

    async _deleteItem(name) {
        const currentFolder = this._getCurrentFolder();

        if (!Object.hasOwn(currentFolder, name)) {
            return;
        }

        const confirmed = await DialogV2.confirm({
            window: {
                title: "Удалить"
            },
            content: `<p>Удалить "${foundry.utils.escapeHTML(name)}"?</p>`,
            yes: {
                label: "Удалить"
            },
            no: {
                label: "Отмена"
            }
        });

        if (!confirmed) {
            return;
        }

        delete currentFolder[name];

        await this._saveImages();

        this.render();
    }

    _browseImage() {
        const picker = new FilePicker({
            type: "image",
            current: this.selectedImagePath,
            callback: path => {
                this.selectedImagePath = path;
            }
        });

        picker.browse();
    }

    async _saveImages() {
        await game.settings.set(
            "novel-dialogue",
            "images",
            this.images
        );
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
        default: {}
    });
});

Hooks.once("ready", () => {
    game.novelDialogue = new NovelDialogue();

    game.socket.on("module.novel-dialogue", data => {
        if (!data) return;
        if (data.action !== "showImage") return;
        if (!data.path) return;

        game.novelDialogue.imagePath = data.path;
        game.novelDialogue.render(true);
    });
});

Hooks.on("getSceneControlButtons", controls => {
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