import MarkdownIt from 'markdown-it';

/**
 * Markdown renderer for AI responses.
 * Raw HTML is disabled so provider output can never inject markup.
 */
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

// Open links in a new tab, safely.
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank');
  tokens[idx].attrSet('rel', 'noopener noreferrer');
  return defaultLinkOpen(tokens, idx, options, env, self);
};

// Code blocks/inline code are LTR technical islands inside the RTL page.
const defaultCodeBlock =
  md.renderer.rules.fence ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  tokens[idx].attrJoin('class', 'ltr');
  return defaultCodeBlock(tokens, idx, options, env, self);
};

const defaultInlineCode =
  md.renderer.rules.code_inline ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
  tokens[idx].attrJoin('class', 'ltr mono');
  return defaultInlineCode(tokens, idx, options, env, self);
};

export function renderMarkdown(source: string): string {
  return md.render(source);
}
