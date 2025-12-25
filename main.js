const { Plugin, Notice, PluginSettingTab, Setting } = require("obsidian");

const DEFAULT_SETTINGS = {
  whitelistFolders: [] // 留空 = 全局生效
};

module.exports = class LawArticleCopyPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new LawArticleCopySettingTab(this.app, this));

    this.registerMarkdownPostProcessor((el, ctx) => {
      // ===== 文件夹白名单判断 =====
      if (this.settings.whitelistFolders.length > 0) {
        if (!ctx.sourcePath) return;

        const matched = this.settings.whitelistFolders.some(folder =>
          ctx.sourcePath === folder || ctx.sourcePath.startsWith(folder + "/")
        );

        if (!matched) return;
      }

      const paragraphs = el.querySelectorAll("p");

      paragraphs.forEach((p, index) => {
        const text = p.innerText?.trim();
        if (!text) return;

        // ===== 条文起始判断 =====
        const isChineseArticle =
          /^(\*\*)?第.+条/.test(text);

        const isDecimalArticle =
          /^\d+(\.\d+)+\s*/.test(text);

        const isDotArticle =
          /^\d+\.\s*/.test(text);

        const isCommaArticle =
          /^\d+、\s*/.test(text);

        if (
          !isChineseArticle &&
          !isDecimalArticle &&
          !isDotArticle &&
          !isCommaArticle
        ) return;

        // 防止重复插入按钮
        if (p.querySelector(".law-copy-btn")) return;

        const btn = document.createElement("span");
        btn.textContent = "📋";
        btn.className = "law-copy-btn";
        btn.title = "复制条文";

		btn.onclick = async (event) => {
		  event.preventDefault();
		  event.stopPropagation();
          const lines = [];

          for (let i = index; i < paragraphs.length; i++) {
            const original = paragraphs[i];
            const currentText = original.innerText.trim();

            // ===== 是否遇到下一条 =====
            const isNextChineseArticle =
              /^(\*\*)?第.+条/.test(currentText);

            const isNextDecimalArticle =
              /^\d+(\.\d+)+\s*/.test(currentText);

            const isNextDotArticle =
              /^\d+\.\s*/.test(currentText);

            const isNextCommaArticle =
              /^\d+、\s*/.test(currentText);

            if (
              i !== index &&
              (
                isNextChineseArticle ||
                isNextDecimalArticle ||
                isNextDotArticle ||
                isNextCommaArticle
              )
            ) {
              break;
            }

            // ===== 克隆并清洗 UI =====
            const clone = original.cloneNode(true);

            clone.querySelectorAll(".law-copy-btn").forEach(el => el.remove());
            clone
              .querySelectorAll(".snw-block-preview, .snw-link-preview")
              .forEach(el => el.remove());

            let cleaned = clone.innerText.trim();
            cleaned = cleaned.replace(/\s*\^[a-zA-Z0-9_-]+$/, "");

            lines.push(cleaned);
          }

          try {
            await navigator.clipboard.writeText(lines.join("\n"));

            // ===== 复制成功反馈 =====
            const originalIcon = btn.textContent;
            const originalTitle = btn.title;

            btn.textContent = "✅";
            btn.title = "已复制";

            setTimeout(() => {
              btn.textContent = originalIcon;
              btn.title = originalTitle;
            }, 1500);

          } catch (err) {
            new Notice("复制失败");
          }
        };
        
        // 给当前段落增加一个类名，方便CSS控制缩进
        p.classList.add("law-article-line");

        p.prepend(btn);
      });
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
};

// ================= 设置界面 =================

class LawArticleCopySettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Law Article Copy 设置" });

    new Setting(containerEl)
      .setName("生效文件夹白名单")
      .setDesc("每行一个文件夹路径；留空表示在所有笔记中生效")
      .addTextArea(text => {
        text
          .setPlaceholder("例如：\n法律法规")
          .setValue(this.plugin.settings.whitelistFolders.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.whitelistFolders =
              value
                .split("\n")
                .map(v => v.trim())
                .filter(v => v.length > 0);

            await this.plugin.saveSettings();
          });
      });
  }
}
