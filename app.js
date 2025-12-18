let discoveredVariants = [];

function cleanHandles(input) {
    return input.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        .map(l => {
            if (l.includes('/products/')) return l.split('/products/')[1].split(/[?#&]/)[0];
            if (/^\d{13,14}$/.test(l)) return l;
            return null;
        }).filter(h => h !== null);
}

async function scanSource(url) {
    try {
        if (url.includes('/collections/')) {
            const handle = url.split('/collections/')[1].split(/[?#&]/)[0];
            const res = await fetch(`https://chiikawamarket.jp/collections/${handle}/products.json?limit=250`);
            const data = await res.json();
            return data.products.map(p => p.handle);
        } else if (url.includes('/pages/')) {
            const res = await fetch(url);
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a[href*="/products/"]'));
            return [...new Set(links.map(a => a.getAttribute('href').split('/products/')[1].split(/[?#&]/)[0]))];
        }
        return [];
    } catch (e) { return []; }
}

async function getVariants(handle) {
    try {
        const res = await fetch(`https://chiikawamarket.jp/products/${handle}.js`);
        const data = await res.json();
        const isPre = data.tags.some(t => t.includes("予約") || t.includes("preorder")) || data.title.includes("予約");
        return data.variants.map(v => ({
            id: v.id,
            pTitle: data.title,
            vTitle: v.title === "Default Title" ? data.title : `${data.title} - ${v.title}`,
            isPre: isPre,
            available: v.available
        }));
    } catch (e) { return [{ error: true, handle }]; }
}

document.getElementById('scanBtn').addEventListener('click', async () => {
    const input = document.getElementById('urlInput').value.trim();
    const status = document.getElementById('statusInfo');
    status.innerText = "🔎 正在嗅探網域資料...";
    status.classList.remove('hidden');
    const handles = await scanSource(input);
    if (handles.length > 0) {
        document.getElementById('urlInput').value = handles.join('\n');
    } else { alert("❌ 無法掃描，請輸入有效連結"); }
    status.classList.add('hidden');
});

document.getElementById('startConvert').addEventListener('click', async () => {
    const handles = cleanHandles(document.getElementById('urlInput').value);
    if (handles.length === 0) return alert("請輸入網址");
    const status = document.getElementById('statusInfo');
    status.innerText = "⚡ 正在提取 Variant ID...";
    status.classList.remove('hidden');
    const results = await Promise.all(handles.map(h => getVariants(h)));
    const list = document.getElementById('variantList');
    const errList = document.getElementById('errorList');
    list.innerHTML = ''; errList.innerHTML = '';
    discoveredVariants = results.flat();
    discoveredVariants.forEach((v, i) => {
        if (v.error) return errList.innerHTML += `<li>解析失敗: ${v.handle}</li>`;
        const item = document.createElement('div');
        item.className = `flex items-center p-3 rounded-xl border-2 mb-2 ${v.available ? 'bg-white border-slate-50 shadow-sm' : 'opacity-40 bg-slate-100'}`;
        item.innerHTML = `<input type="checkbox" id="v-${i}" ${v.available ? 'checked' : 'disabled'} class="w-5 h-5 accent-yellow-500"><div class="ml-3 flex-1"><p class="text-[10px] font-black text-slate-800">${v.vTitle}</p></div>${v.isPre ? '<span class="bg-purple-600 text-white text-[7px] px-1 rounded font-black">PRE</span>' : ''}`;
        list.appendChild(item);
    });
    document.getElementById('variantSelectorSection').classList.remove('hidden');
    document.getElementById('errorSection').classList.toggle('hidden', errList.children.length === 0);
    status.classList.add('hidden');
});

document.getElementById('combineSelected').addEventListener('click', () => {
    const reg = [], pre = [];
    discoveredVariants.forEach((v, i) => {
        const cb = document.getElementById(`v-${i}`);
        if (cb && cb.checked) v.isPre ? pre.push(v.id) : reg.push(v.id);
    });
    if (reg.length + pre.length === 0) return alert("請勾選商品");
    document.getElementById('finalOutput').classList.remove('hidden');
    updateFinalUI('reg', reg);
    updateFinalUI('pre', pre);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

function updateFinalUI(prefix, ids) {
    const section = document.getElementById(`${prefix}Section`);
    const directBtn = document.getElementById(`${prefix}Btn`);
    const cartBtn = document.getElementById(`${prefix}CartBtn`);
    const directDiv = document.getElementById(`${prefix}Direct`);
    const cartDiv = document.getElementById(`${prefix}Cart`);

    if (ids.length > 0) {
        section.classList.remove('hidden');
        const idStr = ids.map(id => `${id}:1`).join(',');
        const checkoutUrl = `https://chiikawamarket.jp/cart/${idStr}`;
        const cartUrl = `${checkoutUrl}?storefront=true`;
        directDiv.innerText = checkoutUrl;
        cartDiv.innerText = cartUrl;
        directBtn.href = checkoutUrl;
        cartBtn.href = cartUrl;
    } else { section.classList.add('hidden'); }
}

window.copyRawUrl = (id) => {
    navigator.clipboard.writeText(document.getElementById(id).innerText).then(() => alert("✅ 已複製連結！"));
};
