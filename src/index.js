export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secret !== env.TELEGRAM_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    const message = body?.message;
    if (!message) return new Response('OK', { status: 200 });

    const chatId = message.chat?.id;
    const text = message.text;

    if (!text) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '⚠️ Só aceito mensagens de texto. Envie um texto ou link.');
      return new Response('OK', { status: 200 });
    }

    const date = new Date().toISOString().slice(0, 10);
    const slug = buildSlug(text);
    const filename = `${date}-${slug}.md`;
    const content = buildMarkdown(text);

    const result = await createGithubFile(env, filename, content);

    if (!result.ok) {
      const errMsg = `Erro ao salvar nota no GitHub: ${result.status} ${result.statusText}`;
      console.error(errMsg, await result.text());
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ ${errMsg}`);
    }

    return new Response('OK', { status: 200 });
  },
};

function buildSlug(text) {
  const isUrl = /^https?:\/\/\S+$/.test(text.trim());

  if (isUrl) {
    return text.trim()
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9\-_.~]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  return text.trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function buildMarkdown(text) {
  return `---\nTipo: Nota rápida\n---\n\n${text}\n`;
}

async function createGithubFile(env, filename, content, suffixed = false) {
  const path = `${env.GITHUB_VAULT_PATH}/${filename}`;
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;

  const body = JSON.stringify({
    message: `feat: add note ${filename}`,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: 'main',
  });

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'telegram-obsidian-bot',
    },
    body,
  });

  // Arquivo já existe — retentar uma vez com sufixo de timestamp
  if (response.status === 422 && !suffixed) {
    const ts = Date.now();
    const base = filename.replace(/\.md$/, '');
    const newFilename = `${base}-${ts}.md`;
    return createGithubFile(env, newFilename, content, true);
  }

  return response;
}

async function sendTelegramMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
