#!/usr/bin/env node
/*
 * Generate simple static HTML previews for selected short-form templates.
 * Usage:  node scripts/generate-static-previews.js contact verify-address
 * Outputs to docs/previews/{slug}.html
 */
const fs = require("fs-extra");
const path = require("path");
const { compile } = require("slm");
const cheerio = require("cheerio");

const projectRoot = path.resolve(__dirname, "..");
const tmplDir = path.join(projectRoot, "app", "assets", "javascripts", "short-form", "templates");
const outDir = path.join(projectRoot, "docs", "previews");
const assetDir = path.join(projectRoot, "docs", "static-preview-assets");
const componentDir = path.join(projectRoot, "app", "assets", "javascripts", "short-form", "components");
const directiveDir = path.join(projectRoot, "app", "assets", "javascripts", "short-form", "directives");
fs.ensureDirSync(outDir);

let slugs = process.argv.slice(2);
if (!slugs.length) {
    // No args: collect slugs from short-form-pages.md automatically
    const mdPath = path.join(__dirname, "short-form-pages.md");
    if (fs.existsSync(mdPath)) {
        const lines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
        const collected = new Set();
        lines.forEach((line) => {
            const m = line.match(/^##\s+(.+)/);
            if (m) {
                const slugCandidate = m[1].trim().split(/\s|\//)[0];
                const safeSlug = slugCandidate.replace(/[^a-zA-Z0-9\-]/g, "");
                if (safeSlug) collected.add(safeSlug);
            }
        });
        slugs = Array.from(collected);
    }
    if (!slugs.length) {
        console.error("Provide page slugs, e.g. contact verify-address");
        process.exit(1);
    }
    console.log(`No slugs provided. Generating previews for ${slugs.length} pages from short-form-pages.md`);
}

// Recursively collect .html.slim templates (components + directives) for auto-inlining
function collectTemplates(rootDir) {
    const templates = {};
    if (!fs.existsSync(rootDir)) return templates;
    const walk = dir => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith(".html.slim")) {
                const tag = entry.name.replace(/\.html\.slim$/, "");
                try {
                    templates[tag] = stripOuterShell(compile(fs.readFileSync(full, "utf8"))());
                } catch (e) {
                    console.warn(`⚠️  Failed to compile template ${full}:`, e.message);
                }
            }
        });
    };
    walk(rootDir);
    return templates;
}

// Pre-compile templates for components and directives
const componentMap = {
    ...collectTemplates(componentDir),
    ...collectTemplates(directiveDir),
};

function findTemplate(slug) {
    const files = fs.readdirSync(tmplDir).filter(f => f.includes(slug) && f.endsWith(".slim"));
    if (!files.length) return null;
    // heuristic: prefer file starting with section letter/number (e.g., b2-contact)
    files.sort();
    return path.join(tmplDir, files[0]);
}

function stripOuterShell(html) {
    const $ = cheerio.load(html, { xmlMode: false });

    if ($('body').length) {
        return $('body').html();
    }
    return html;
}

function compileSlim(filePath) {
    const slimSrc = fs.readFileSync(filePath, "utf8");
    // compile without evaluation of #{}, keep Angular {{ }} unchanged
    return stripOuterShell(compile(slimSrc)());
}

// Load English translations object directly so keys like "label.applicant_phone" resolve
const translations = JSON.parse(
    fs.readFileSync(
        path.join(projectRoot, "app", "assets", "json", "translations", "locale-en.json"),
        "utf8",
    ),
).en;

function translateKey(key) {
    // support dot notation like label.first_name
    const parts = key.split(".");
    let obj = translations;
    for (const part of parts) {
        if (!obj || !Object.prototype.hasOwnProperty.call(obj, part)) return key;
        obj = obj[part];
    }
    return typeof obj === "string" ? obj : key;
}

function applyTranslationsToHtml(html) {
    // 1. inline sub-templates so their contents also get translated
    html = inlineSubTemplates(html);
    // 2. replace mustache placeholders like {{ 'key' | translate }}
    html = html.replace(/\{\{\s*'?([\w\.]+)'?\s*\|\s*translate\s*}}/g, (_, key) => translateKey(key));
    const $ = cheerio.load(html);
    // 3. handle translate attributes
    $('[translate]').each((_, el) => {
        const key = $(el).attr('translate');
        $(el).text(translateKey(key));
        $(el).removeAttr('translate');
    });
    return stripOuterShell($.html());
}

function inlineSubTemplates(html) {
    let $ = cheerio.load(html, { xmlMode: false });
    let replacedAny = true;
    // iterate until no more custom tags found (handles nested components)
    while (replacedAny) {
        replacedAny = false;
        Object.entries(componentMap).forEach(([tag, tpl]) => {
            $(tag).each((_, el) => {
                replacedAny = true;
                const transcludedHtml = $(el).html();
                // clone template for this instance
                const $tpl = cheerio.load(tpl, { xmlMode: false })('body').length ? cheerio.load(tpl)('body').html() : tpl;
                let $instance = cheerio.load($tpl, { xmlMode: false });
                // insert transcluded content into transclusion slots (element or attribute)
                $instance('[ng-transclude], ng-transclude').each((_, transEl) => {
                    const t = $instance(transEl);
                    // if the element itself is <ng-transclude>, replace it entirely
                    if (t[0].tagName && t[0].tagName.toLowerCase() === 'ng-transclude') {
                        t.replaceWith(transcludedHtml);
                    } else {
                        // otherwise, it's an attribute-based transclusion; keep the element wrapper
                        t.removeAttr('ng-transclude');
                        t.html(transcludedHtml);
                    }
                });
                $(el).replaceWith($instance.html());
            });
        });
        if (replacedAny) $ = cheerio.load($.html(), { xmlMode: false });
    }
    return $.html();
}

const shellTop = (title) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="${path.relative(outDir, path.join(assetDir, "style.css"))}"></head><body>`;
const shellBottom = `</body></html>`;

slugs.forEach(slug => {
    const tmpl = findTemplate(slug);
    if (!tmpl) {
        console.warn(`⚠️  No template found for ${slug}`);
        return;
    }
    const slimHtml = compileSlim(tmpl);
    const translated = applyTranslationsToHtml(slimHtml);
    // if the template itself already starts with an app-card wrapper, don't add another one
    const hasAppCard = /<div[^>]*class="[^"]*\bapp-card\b/.test(translated.trim().slice(0, 200));
    const bodyContent = hasAppCard ? translated : `<div class="app-card">${translated}</div>`;
    const outHtml = `${shellTop(slug)}\n${bodyContent}\n${shellBottom}`;
    fs.writeFileSync(path.join(outDir, `${slug}.html`), outHtml, "utf8");
    console.log(`✓ Generated ${slug}.html`);
});

// ----------------- Generate index.html -----------------
(function generateIndex() {
    const mdPath = path.join(__dirname, "short-form-pages.md");
    if (!fs.existsSync(mdPath)) return;
    const mdLines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
    let html = "";
    let inList = false;
    let blockOpen = false;
    let currentIframe = "";
    const flushList = () => { if (inList) { html += '</ul>'; inList = false; } };
    const closeBlock = () => {
        if (blockOpen) {
            flushList();
            html += '</div>';
            if (currentIframe) html += currentIframe;
            html += '</div>';
            blockOpen = false;
            currentIframe = "";
        }
    };
    mdLines.forEach((line) => {
        // h2 headings map to slugs
        let m;
        if ((m = line.match(/^##\s+(.+)/))) {
            closeBlock();
            const heading = m[1].trim();
            // take first token before space or slash as slug (e.g. "contact" from "contact" or "alternate-contact-type / ...")
            const slugCandidate = heading.split(/\s|\//)[0];
            const safeSlug = slugCandidate.replace(/[^a-zA-Z0-9\-]/g, "");
            if (fs.existsSync(path.join(outDir, `${safeSlug}.html`))) {
                html += `<div class="page-block"><div class="page-info">`;
                html += `<h2><a href="${safeSlug}.html">${heading}</a></h2>`;
                currentIframe = `<iframe class="page-preview" src="${safeSlug}.html"></iframe>`;
            } else {
                html += `<div class="page-block"><div class="page-info">`;
                html += `<h2>${heading}</h2>`;
                currentIframe = "";
            }
            blockOpen = true;
        } else if ((m = line.match(/^###\s+(.+)/))) {
            flushList();
            html += `<h3>${m[1].trim()}</h3>`;
        } else if ((m = line.match(/^#\s+(.+)/))) {
            closeBlock();
            html += `<h1>${m[1].trim()}</h1>`;
        } else if (/^---$/.test(line.trim())) {
            html += "<hr>";
        } else if (line.trim().length === 0) {
            html += ""; // skip blank lines but keep block open
        } else if (line.trim().startsWith('>')) {
            const inner = line.replace(/^>\s?/, '');
            let converted = inner
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>');
            html += `<blockquote>${converted}</blockquote>`;
        } else if (/^[-*•]\s+/.test(line.trim())) {
            const itemText = line.trim().replace(/^[-*•]\s+/, '');
            let converted = itemText
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>');
            if (!inList) { html += '<ul>'; inList = true; }
            html += `<li>${converted}</li>`;
        } else {
            closeBlock();
            // basic inline markdown (links, bold, code)
            let converted = line
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // bold
                .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '<em>$1</em>') // italics
                .replace(/`([^`]+)`/g, '<code>$1</code>') // inline code
                .replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>'); // link
            html += `<p>${converted}</p>`;
        }
    });
    closeBlock();
    const templatePath = path.join(assetDir, "index-template.html");
    let templateHtml;
    if (fs.existsSync(templatePath)) {
        templateHtml = fs.readFileSync(templatePath, "utf8");
    } else {
        templateHtml = `${shellTop("preview index")}\n{{CONTENT}}\n${shellBottom}`;
    }
    const indexHtml = templateHtml.replace("{{CONTENT}}", html);
    fs.writeFileSync(path.join(outDir, "index.html"), indexHtml, "utf8");
    console.log("✓ Generated index.html");
})();
