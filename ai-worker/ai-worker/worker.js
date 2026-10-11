// Máy chủ AI của RoseKids (Cloudflare Worker).
// Khóa Anthropic cất trong biến bí mật ANTHROPIC_API_KEY của Worker, giáo viên không nhìn thấy.
// Chỉ tài khoản đang hoạt động của app (đọc được settings/ai trên Firestore) mới gọi được.
// Viết bằng fetch thuần vì trình soạn Worker trên trang Cloudflare không cài được gói npm.

const FIREBASE_PROJECT = 'rosekids-32f0c';
const ALLOWED_ORIGIN = 'https://hoaihoahong.github.io';
const MODEL = 'claude-opus-5-5';

const DAYS = 6;
const GOC = ['Góc phân vai', 'Góc xây dựng', 'Góc học tập', 'Góc nghệ thuật', 'Góc âm nhạc', 'Góc kể chuyện', 'Góc thiên nhiên'];
const DOM = ['TC', 'NN', 'NT', 'TX', 'NgT', 'KNS'];

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['donTre', 'hdh', 'ngoaiTroi', 'goc', 'anNguVs', 'chieu', 'traTre', 'note'],
  properties: {
    donTre: { type: 'string', description: 'Đón trẻ, thể dục sáng, ăn sáng – chung cả tuần, mỗi ý một dòng bắt đầu bằng "- "' },
    hdh: { type: 'array', description: 'Đúng 6 phần tử, Thứ hai đến Thứ bảy', items: { type: 'object', additionalProperties: false, required: ['dom', 'title'], properties: { dom: { type: 'string', enum: DOM }, title: { type: 'string' } } } },
    ngoaiTroi: { type: 'array', description: 'Đúng 6 phần tử, Thứ hai đến Thứ bảy', items: { type: 'string' } },
    goc: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'content'], properties: { name: { type: 'string', enum: GOC }, content: { type: 'string' } } } },
    anNguVs: { type: 'string', description: 'Ăn – ngủ – vệ sinh, chung cả tuần, mỗi ý một dòng bắt đầu bằng "- "' },
    chieu: { type: 'array', description: 'Đúng 6 phần tử, Thứ hai đến Thứ bảy', items: { type: 'string' } },
    traTre: { type: 'string', description: 'Trả trẻ, chung cả tuần, mỗi ý một dòng bắt đầu bằng "- "' },
    note: { type: 'string', description: 'Một câu ngắn gửi giáo viên về đồ dùng cần chuẩn bị hoặc điều cần lưu ý; có thể để trống' },
  },
};

const SYSTEM = `Bạn là giáo viên mầm non dạy giỏi, 10 năm kinh nghiệm, đã được tập huấn Chương trình giáo dục mầm non thí điểm (soạn theo mục tiêu và yêu cầu cần đạt, lấy trẻ làm trung tâm, học qua chơi và trải nghiệm). Bạn soạn kế hoạch giáo dục tuần cho một lớp của Trường Mầm non Hoa Hồng.

Viết tiếng Việt, ngắn gọn, đúng văn phong kế hoạch tuần giáo viên mầm non vẫn ghi. Mẫu của trường (lớp Lá 1, tuần 6, nhánh Cơ thể tôi):
- Đón trẻ, TDS, ăn sáng (chung cả tuần): "- Cô đón trẻ với thái độ vui tươi, niềm nở.\\n- Thể dục sáng: Tập thể dục sáng tại sân trường. Nội dung theo KH TDS\\n- Ăn sáng: Bé ăn sáng tại trường"
- Hoạt động học, mỗi ngày một hoạt động có ghi lĩnh vực: Thứ hai NN "LQVCC: âm \\"nh, th\\""; Thứ ba TX "Nhận biết hành vi ứng xử phù hợp với giới tính."; Thứ tư NT "Đếm và so sánh số lượng trong phạm vi 7."; Thứ năm TC "Bò, trườn qua vật cản."; Thứ sáu NgT "VĐTN: \\"Xem đôi tai này, xem mái tóc này\\""; Thứ bảy KNS "Ứng xử nơi công cộng".
- Chơi ngoài trời, mỗi ngày một hoạt động: "Chơi với khu vui chơi.", "Ném bowling.", "Xếp hình về cơ thể bé.", "Bé ngồi nghe cô kể chuyện.", "Trò chơi: \\"Vượt chướng ngại vật\\".", "Chơi với khu vui chơi."
- Góc chơi: chọn 3 đến 4 góc hợp chủ đề, mỗi góc ghi ngắn nội dung chơi.
- Ăn – ngủ – vệ sinh và Trả trẻ dùng chung cả tuần (Trả trẻ có trao đổi với phụ huynh). Sinh hoạt chiều mỗi ngày một hoạt động; Thứ bảy thường là cô và trò lau rửa đồ chơi chuẩn bị cho tuần tiếp theo.

Yêu cầu:
- Mỗi mục tiêu của tuần được thực hiện qua ít nhất một hoạt động học đúng lĩnh vực của mã (TC Thể chất, NN Ngôn ngữ, NT Nhận thức, TX Tình cảm – xã hội, NgT Nghệ thuật). Ưu tiên thứ tự Thứ hai NN, Thứ ba TX, Thứ tư NT, Thứ năm TC, Thứ sáu NgT, Thứ bảy KNS; nếu tuần có nhiều mục tiêu cùng lĩnh vực thì điều chỉnh cho hợp lý, có thể lồng mục tiêu còn lại vào chơi ngoài trời hoặc sinh hoạt chiều.
- Bám sát chủ đề nhánh và đúng độ tuổi. Với nhà trẻ (dưới 36 tháng) không dùng làm quen chữ cái, đếm số lớn hay bài tập viết; chọn nhận biết, vận động, nghe hát, xem tranh, chơi với đồ vật.
- Nếu giáo viên đã ghi nội dung hoặc hoạt động cho mục tiêu thì dùng đúng các ý đó.
- Hoạt động an toàn, khả thi ở lớp mầm non công lập, đồ dùng dễ chuẩn bị.
- Mảng hdh, ngoaiTroi, chieu có đúng 6 phần tử theo thứ tự Thứ hai đến Thứ bảy.`;

const cut = (v, n = 400) => String(v ?? '').slice(0, n);

function userPrompt(r) {
  const goals = (Array.isArray(r.goals) ? r.goals : []).slice(0, 20).map(g =>
    `- ${cut(g.code, 20)} (${cut(g.domain, 30)}): ${cut(g.name) || '(chưa có tên mục tiêu)'}` +
    (g.content ? `\n  Nội dung giáo viên đã ghi: ${cut(g.content)}` : '') +
    (g.activity ? `\n  Hoạt động giáo viên đã ghi: ${cut(g.activity)}` : '')).join('\n');
  return `Soạn kế hoạch giáo dục tuần ${cut(r.week, 5)} cho lớp ${cut(r.cls, 60)} (${cut(r.block, 80)}; độ tuổi ${cut(r.age, 10)}).
Thời gian: từ ${cut(r.from, 12)} đến ${cut(r.to, 12)}, học từ Thứ hai đến Thứ bảy.
Chủ đề lớn: ${cut(r.topic, 120)} (${cut(r.topicFrom, 12)} – ${cut(r.topicTo, 12)}). Chủ đề nhánh: ${cut(r.sub, 120)}.${r.prevSub ? `\nTuần trước lớp học nhánh ${cut(r.prevSub, 120)}.` : ''}
Mục tiêu của tuần:
${goals}`;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors(origin) } });
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (request.method !== 'POST') return json({ error: 'Chỉ nhận yêu cầu POST' }, 405);
    if (origin !== ALLOWED_ORIGIN) return json({ error: 'Không đúng trang web của trường' }, 403);

    // Xác thực: dùng chính mã đăng nhập Firebase của người dùng để đọc settings/ai.
    // Firestore Rules chỉ cho tài khoản đang hoạt động đọc tài liệu này.
    const auth = request.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Cần đăng nhập' }, 401);
    const check = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/settings/ai`, { headers: { authorization: auth } });
    if (!check.ok) return json({ error: 'Tài khoản chưa được dùng chức năng AI' }, 403);

    let req;
    try { req = await request.json(); } catch { return json({ error: 'Dữ liệu gửi lên không đúng' }, 400); }
    if (req.task !== 'weekPlan') return json({ error: 'Chưa hỗ trợ yêu cầu này' }, 400);

    if (!env.ANTHROPIC_API_KEY) return json({ error: 'Máy chủ chưa có khóa AI: vào Settings → Variables and Secrets thêm ANTHROPIC_API_KEY' }, 500);

    let res;
    try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt(req) }],
      }),
    });
    } catch (e) { return json({ error: `Máy chủ không gọi được AI (${String(e?.message || e).slice(0, 200)})` }, 502); }
    const msg = await res.json().catch(() => ({}));
    if (!res.ok) {
      const t = msg?.error?.type || '';
      const m = res.status === 401 ? 'Khóa AI trên máy chủ không đúng'
        : res.status === 403 && t === 'forbidden' ? 'Máy chủ đang chạy ở vùng AI không phục vụ'
        : res.status === 429 || t === 'overloaded_error' ? 'AI đang quá tải, cô thử lại sau ít phút'
        : /credit|billing/i.test(msg?.error?.message || '') ? 'Tài khoản AI của trường đã hết tiền'
        : 'AI chưa soạn được, cô thử lại';
      // Kèm nguyên văn lỗi của Anthropic (không chứa khóa) để dễ tìm nguyên nhân.
      const detail = `${res.status}${t ? ' ' + t : ''}: ${String(msg?.error?.message || '').slice(0, 300)}; máy chủ chạy tại ${request.cf?.colo || '?'}`;
      return json({ error: `${m} (chi tiết: ${detail})` }, 502);
    }
    if (msg.stop_reason === 'refusal') return json({ error: 'AI không soạn nội dung này, cô thử lại hoặc soạn tay' }, 422);
    if (msg.stop_reason === 'max_tokens') return json({ error: 'AI trả lời bị cắt giữa chừng, cô bấm soạn lại' }, 502);
    const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    let plan;
    try { plan = JSON.parse(text); } catch { return json({ error: 'AI trả lời sai định dạng, cô bấm soạn lại' }, 502); }
    return json({ plan, model: msg.model, usage: msg.usage });
  },
};
