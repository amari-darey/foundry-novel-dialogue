import { NovelDialogue } from "./dialogue.js";
import { NovelDialogueManager } from "./manager.js";

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
    console.log("[ND] getSceneControlButtons")
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