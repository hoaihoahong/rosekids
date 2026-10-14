// Máy chủ AI của RoseKids (Cloudflare Worker): soạn KH chủ đề, Kế hoạch tuần, Giáo án ngày và KH đánh giá.
// Khóa Anthropic cất trong biến bí mật ANTHROPIC_API_KEY của Worker, giáo viên không nhìn thấy.
// Chỉ tài khoản đang hoạt động của app (đọc được settings/ai trên Firestore) mới gọi được.
// Viết bằng fetch thuần vì trình soạn Worker trên trang Cloudflare không cài được gói npm.

const FIREBASE_PROJECT = 'rosekids-32f0c';
const ALLOWED_ORIGIN = 'https://hoaihoahong.github.io';
// Mô hình AI: Ban giám hiệu chọn trong Bảng tham số (settings/ai.aiModel); để trống thì dùng Opus như trước.
// Giá Anthropic (USD cho 1 triệu token đầu vào / đầu ra), dùng để báo chi phí mỗi lượt.
const MODELS = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};
const MODEL = 'claude-opus-5-5';

const DAYS = 6;
const GOC = ['Góc phân vai', 'Góc xây dựng', 'Góc học tập', 'Góc nghệ thuật', 'Góc âm nhạc', 'Góc kể chuyện', 'Góc thiên nhiên'];
const DOM = ['TC', 'NN', 'NT', 'TX', 'NgT', 'KNS'];

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['donTre', 'hdh', 'ngoaiTroi', 'gocNgay', 'anNguVs', 'chieu', 'traTre', 'note'],
  properties: {
    donTre: { type: 'string', description: 'Đón trẻ, ăn sáng – chung cả tuần, mỗi ý một dòng bắt đầu bằng "- " (không ghi thể dục sáng)' },
    hdh: { type: 'array', description: 'Đúng 6 phần tử, Thứ hai đến Thứ bảy', items: { type: 'object', additionalProperties: false, required: ['dom', 'title'], properties: { dom: { type: 'string', enum: DOM }, title: { type: 'string' } } } },
    ngoaiTroi: { type: 'array', description: 'Đúng 6 phần tử, Thứ hai đến Thứ bảy', items: { type: 'string' } },
    gocNgay: { type: 'array', description: 'Hoạt động vui chơi trong lớp, đúng 6 phần tử, Thứ hai đến Thứ bảy; mỗi ngày 1 đến 3 góc, mỗi góc một dòng dạng "Tên góc: nội dung chơi"', items: { type: 'string' } },
    anNguVs: { type: 'string', description: 'Ăn – ngủ – vệ sinh, chung cả tuần, mỗi ý một dòng bắt đầu bằng "- "' },
    chieu: { type: 'array', description: 'Đúng 6 phần tử, Thứ hai đến Thứ bảy', items: { type: 'string' } },
    traTre: { type: 'string', description: 'Trả trẻ, chung cả tuần, mỗi ý một dòng bắt đầu bằng "- "' },
    note: { type: 'string', description: 'Một câu ngắn gửi giáo viên về đồ dùng cần chuẩn bị hoặc điều cần lưu ý; có thể để trống' },
  },
};

const SYSTEM = `Bạn là giáo viên mầm non dạy giỏi, 10 năm kinh nghiệm, đã được tập huấn Chương trình giáo dục mầm non thí điểm (soạn theo mục tiêu và yêu cầu cần đạt, lấy trẻ làm trung tâm, học qua chơi và trải nghiệm). Bạn soạn kế hoạch giáo dục tuần cho một lớp của Trường Mầm non Hoa Hồng.

Viết tiếng Việt, ngắn gọn, đúng văn phong kế hoạch tuần giáo viên mầm non vẫn ghi. Mẫu của trường (lớp Lá 1, tuần 6, nhánh Cơ thể tôi):
- Đón trẻ, ăn sáng (chung cả tuần): "- Cô đón trẻ với thái độ vui tươi, niềm nở.\\n- Ăn sáng: Bé ăn sáng tại trường". Thể dục sáng là dòng riêng theo KH TDS của trường, không soạn.
- Hoạt động học, mỗi ngày một hoạt động có ghi lĩnh vực: Thứ hai NN "LQVCC: âm \\"nh, th\\""; Thứ ba TX "Nhận biết hành vi ứng xử phù hợp với giới tính."; Thứ tư NT "Đếm và so sánh số lượng trong phạm vi 7."; Thứ năm TC "Bò, trườn qua vật cản."; Thứ sáu NgT "VĐTN: \\"Xem đôi tai này, xem mái tóc này\\""; Thứ bảy KNS "Ứng xử nơi công cộng".
- Hoạt động ngoài trời, mỗi ngày một hoạt động: "Chơi với khu vui chơi.", "Ném bowling.", "Xếp hình về cơ thể bé.", "Bé ngồi nghe cô kể chuyện.", "Trò chơi: \\"Vượt chướng ngại vật\\".", "Chơi với khu vui chơi."
- Hoạt động vui chơi trong lớp ghi theo từng ngày, mỗi ngày 1 đến 3 góc hợp chủ đề, mỗi góc một dòng ghi ngắn nội dung chơi, ví dụ Thứ hai "Góc phân vai: Gia đình của bé; phòng khám bác sĩ – cân, đo cho bạn.\\nGóc âm nhạc: Hát các bài về bản thân"; thay đổi góc giữa các ngày. Tên góc chọn trong: ${GOC.join(', ')}.
- Ăn – ngủ – vệ sinh và Trả trẻ dùng chung cả tuần (Trả trẻ có trao đổi với phụ huynh). Sinh hoạt chiều mỗi ngày một hoạt động; Thứ bảy thường là cô và trò lau rửa đồ chơi chuẩn bị cho tuần tiếp theo.

Yêu cầu:
- Mỗi mục tiêu của tuần được thực hiện qua ít nhất một hoạt động học đúng lĩnh vực của mã (TC Thể chất, NN Ngôn ngữ, NT Nhận thức, TX Tình cảm – xã hội, NgT Nghệ thuật). Ưu tiên thứ tự Thứ hai NN, Thứ ba TX, Thứ tư NT, Thứ năm TC, Thứ sáu NgT, Thứ bảy KNS; nếu tuần có nhiều mục tiêu cùng lĩnh vực thì điều chỉnh cho hợp lý, có thể lồng mục tiêu còn lại vào chơi ngoài trời hoặc sinh hoạt chiều.
- Bám sát chủ đề nhánh và đúng độ tuổi. Với nhà trẻ (dưới 36 tháng) không dùng làm quen chữ cái, đếm số lớn hay bài tập viết; chọn nhận biết, vận động, nghe hát, xem tranh, chơi với đồ vật.
- Nếu giáo viên đã ghi nội dung hoặc hoạt động cho mục tiêu thì dùng đúng các ý đó.
- Hoạt động an toàn, khả thi ở lớp mầm non công lập, đồ dùng dễ chuẩn bị.
- Mảng hdh, ngoaiTroi, gocNgay, chieu có đúng 6 phần tử theo thứ tự Thứ hai đến Thứ bảy.`;

// ---------- Giáo án ngày ----------
const STEPS5 = ['Bước 1. Khởi động – Tạo tình huống học tập', 'Bước 2. Khám phá – Trải nghiệm [Trải nghiệm trước]', 'Bước 3. Chia sẻ – Hình thành kiến thức [Giải thích sau]', 'Bước 4. Thực hành – Vận dụng', 'Bước 5. Chia sẻ – Đánh giá'];
// Các mục cần soạn theo mẫu GA ngày của trường: hoc, nt có Phẩm chất, Năng lực; nt có Địa điểm; hoc có Tích hợp.
const GA_KIND = {
  hoc: { name: 'Hoạt động học', steps: STEPS5, pcnl: true, tichHop: true },
  nt: { name: 'Hoạt động vui chơi ngoài trời', steps: ['Bước 1. Khởi động – Tạo tình huống vui chơi', 'Bước 2. Trò chơi có chủ đích', 'Bước 3. Trò chơi tự do', 'Bước 4. Kết thúc'], pcnl: true, diaDiem: true },
  goc: { name: 'Hoạt động góc', steps: ['Bước 1. Gây hứng thú', 'Bước 2. Thỏa thuận trước khi chơi', 'Bước 3. Quá trình trẻ chơi', 'Bước 4. Nhận xét – kết thúc'] },
  chieu: { name: 'Hoạt động chiều', steps: STEPS5 },
};

const LESSON_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['tenHoatDong', 'linhVuc', 'tichHop', 'mucTieu', 'phamChat', 'nangLuc', 'diaDiem', 'chuanBi', 'tienTrinh', 'note'],
  properties: {
    tenHoatDong: { type: 'string', description: 'Tên hoạt động ngắn gọn, ví dụ "Phát triển ngôn ngữ – LQVCC: âm \\"nh, th\\"". Với Hoạt động góc: mỗi góc một dòng dạng "Góc phân vai: nội dung chơi", góc trọng tâm ghi đầu tiên' },
    linhVuc: { type: 'string', description: 'Lĩnh vực phát triển, ví dụ "Phát triển Ngôn ngữ"; để trống với Hoạt động góc' },
    tichHop: { type: 'string', description: 'Chỉ với Hoạt động học: các lĩnh vực, nội dung được tích hợp, ví dụ "Âm nhạc, Phát triển nhận thức"; loại khác để trống' },
    mucTieu: { type: 'array', description: '4 đến 6 mục tiêu, mỗi mục tiêu một câu bắt đầu bằng "Trẻ …", không ghi dấu gạch đầu dòng', items: { type: 'string' } },
    phamChat: { type: 'array', description: 'Chỉ với Hoạt động học và Hoạt động vui chơi ngoài trời: 1 đến 3 phẩm chất trẻ được hình thành qua hoạt động, mỗi ý một câu ngắn nêu tên phẩm chất và biểu hiện cụ thể trong hoạt động; loại khác để mảng rỗng', items: { type: 'string' } },
    nangLuc: { type: 'array', description: 'Chỉ với Hoạt động học và Hoạt động vui chơi ngoài trời: 2 đến 3 năng lực trẻ được phát triển qua hoạt động, mỗi ý một câu ngắn nêu tên năng lực và biểu hiện cụ thể; loại khác để mảng rỗng', items: { type: 'string' } },
    diaDiem: { type: 'string', description: 'Chỉ với Hoạt động vui chơi ngoài trời: nơi tổ chức, ví dụ "Sân trường, khu vui chơi"; loại khác để trống' },
    chuanBi: { type: 'array', description: 'Đồ dùng của cô, của trẻ, không gian; mỗi ý một phần tử, không ghi dấu gạch đầu dòng. Với Hoạt động góc: một ý cho không gian, rồi mỗi góc một ý dạng "Góc …: đồ dùng"', items: { type: 'string' } },
    tienTrinh: { type: 'array', description: 'Các bước của tiến trình, đúng tên bước đã cho', items: { type: 'object', additionalProperties: false, required: ['buoc', 'noiDung'], properties: { buoc: { type: 'string' }, noiDung: { type: 'string', description: 'Mỗi ý một dòng. Câu cô hỏi gợi mở bắt đầu bằng "- ". Phần nhỏ ghi "a. …", "b. …" trên một dòng riêng.' } } } },
    note: { type: 'string', description: 'Một câu ngắn gửi giáo viên về điều cần lưu ý; có thể để trống' },
  },
};

const LESSON_SYSTEM = `Bạn là cô giáo mầm non xuất sắc, 10 năm kinh nghiệm, đã được tập huấn và hiểu bản chất, nội hàm, những điểm thay đổi và cái mới, cách tư duy của Chương trình giáo dục mầm non thí điểm ban hành theo Quyết định 388 của Bộ Giáo dục và Đào tạo. Bạn soạn giáo án một hoạt động trong ngày cho lớp của Trường Mầm non Hoa Hồng.

Nguyên tắc soạn:
- Đi từ yêu cầu cần đạt và mục tiêu của tuần: xác định trẻ cần đạt gì, rồi mới chọn nội dung, hoạt động, đồ dùng phù hợp. Mục tiêu viết cụ thể, quan sát được, đúng độ tuổi.
- Giáo án góp phần hình thành, phát triển 4 phẩm chất và 5 năng lực cốt lõi của trẻ theo chương trình thí điểm.
- Lấy trẻ làm trung tâm: trẻ được chủ động, được trải nghiệm trước, cô giải thích sau; trẻ có cơ hội nói ra suy nghĩ, ý tưởng của mình, được chia sẻ, hợp tác với bạn. Cô nói ít lời, chủ yếu gợi hỏi mở, quan sát, khuyến khích; không giảng giải dài.
- Giáo án cô đọng, đủ ý, câu ngắn, đúng văn phong giáo án giáo viên mầm non Việt Nam. Không viết lời bình luận, không giải thích lý thuyết.
- Với nhà trẻ (dưới 36 tháng): hoạt động đơn giản, ngắn, nhiều vận động và đồ vật thật; không làm quen chữ cái, không đếm số lớn, không tập viết.
- Hoạt động an toàn, khả thi ở lớp mầm non công lập, đồ dùng dễ chuẩn bị.
- Nếu giáo viên đã ghi nội dung, hoạt động hoặc gợi ý thì bám đúng các ý đó.

Văn phong mẫu của trường (giáo án Hoạt động học lớp Lá 1, LQVCC âm "nh, th"):
Mục tiêu: "Trẻ nhận biết và phát âm đúng chữ cái th, nh."; "Trẻ biết so sánh điểm giống và khác nhau giữa chữ th và chữ nh."; "Phát triển khả năng quan sát, ghi nhớ, so sánh, tư duy và khả năng giải quyết vấn đề."; "Trẻ hứng thú tham gia hoạt động, mạnh dạn chia sẻ kết quả và phối hợp cùng bạn."
Bước 1. Khởi động – Tạo tình huống học tập:
"Cô cho trẻ vận động theo nhạc.
Cô xuất hiện với một chiếc túi bí mật có các hình ảnh: con thỏ, chiếc thuyền, ngôi nhà, con nhện và trò chuyện với trẻ:
- Các con nhìn xem trong túi của cô có những hình ảnh gì?
- Trong các từ "con thỏ", "chiếc thuyền", "ngôi nhà", "con nhện", các con có nhận ra những chữ nào đặc biệt không?"
Bước 2. Khám phá – Trải nghiệm [Trải nghiệm trước]:
"a. Khám phá chữ nh
Cô cho trẻ quan sát tranh ngôi nhà và thẻ từ "ngôi nhà". Cô gợi hỏi:
- Trong từ "nhà", con nhìn thấy chữ nào đặc biệt?
...
c. Trải nghiệm với chữ cái
Cô phát cho trẻ các thẻ chữ cái t, h, n:
- Các con hãy thử ghép các chữ cái để tạo thành chữ nh và chữ th.
Trẻ thực hiện theo ý tưởng của mình, quan sát và chia sẻ kết quả. Cô chưa vội kết luận để trẻ tự khám phá."
Bước 3 cô mời trẻ chia sẻ rồi mới khái quát; Bước 4 là 1 – 2 trò chơi vận dụng có luật chơi rõ; Bước 5 cô hỏi lại trẻ, nhận xét, động viên, cùng trẻ thu dọn.

Giáo án Hoạt động vui chơi ngoài trời của trường gồm: Khởi động – Tạo tình huống vui chơi; Trò chơi có chủ đích (quan sát, khám phá hoặc trò chơi vận động có mục đích, gắn chủ đề); Trò chơi tự do (trẻ tự chọn đồ chơi, khu vui chơi, cô bao quát an toàn); Kết thúc.
Giáo án Hoạt động chiều dùng 5 bước như Hoạt động học nhưng ngắn gọn, nhẹ nhàng hơn.
Giáo án Hoạt động góc của trường có: Mục tiêu (trẻ hiểu tên góc, nội dung, quy tắc chơi; biết nhập vai và thể hiện vai; biết liên kết giữa các góc); Chuẩn bị (không gian; đồ dùng theo từng góc, ghi rõ góc trọng tâm); Tiến trình 4 bước: Gây hứng thú; Thỏa thuận trước khi chơi; Quá trình trẻ chơi (cô bao quát, nhập vai cùng trẻ, gợi ý liên kết góc, xử lý tình huống); Nhận xét – kết thúc (trẻ tự nhận xét, cô nhận xét, cùng thu dọn).`;

function lessonPrompt(r) {
  const K = GA_KIND[r.kind];
  const goals = (Array.isArray(r.goals) ? r.goals : []).slice(0, 20).map(g =>
    `- ${cut(g.code, 20)} (${cut(g.domain, 30)}): ${cut(g.name) || '(chưa có tên mục tiêu)'}` +
    (g.yccd && g.yccd !== g.name ? `\n  Yêu cầu cần đạt: ${cut(g.yccd)}` : '') +
    (g.content ? `\n  Nội dung giáo viên đã ghi: ${cut(g.content)}` : '') +
    (g.activity ? `\n  Hoạt động giáo viên đã ghi: ${cut(g.activity)}` : '')).join('\n');
  const act = r.kind === 'goc'
    ? `Các góc chơi trong kế hoạch tuần:\n${(Array.isArray(r.goc) ? r.goc : []).slice(0, 8).map(g => `- ${cut(g.name, 40)}${g.content ? ': ' + cut(g.content) : ''}`).join('\n') || '(chưa có)'}`
    : r.kind === 'hoc'
      ? `Hoạt động học trong kế hoạch tuần ngày này: ${cut(r.dom, 40)} – ${cut(r.title, 400)}`
      : r.kind === 'nt'
        ? `Hoạt động ngoài trời trong kế hoạch tuần ngày này: ${cut(r.title, 400)}`
        : `Sinh hoạt chiều trong kế hoạch tuần ngày này: ${cut(r.title, 400)}`;
  return `Soạn giáo án ${K.name} cho lớp ${cut(r.cls, 60)} (${cut(r.block, 80)}; độ tuổi ${cut(r.age, 10)}).
Tuần ${cut(r.week, 5)}, ${cut(r.day, 20)}, ngày ${cut(r.date, 12)}.
Chủ đề lớn: ${cut(r.topic, 120)}. Chủ đề nhánh: ${cut(r.sub, 120)}.
${act}
Mục tiêu của tuần (chọn những mục tiêu phù hợp với hoạt động này để xác định mục tiêu giáo án):
${goals || '(chưa có)'}
${r.hint ? `Gợi ý thêm của giáo viên: ${cut(r.hint, 600)}\n` : ''}Tiến trình hoạt động gồm đúng các bước, theo thứ tự: ${K.steps.join('; ')}.
${K.pcnl ? 'Ghi Phẩm chất và Năng lực trẻ được hình thành qua hoạt động, gắn với mục tiêu.' : 'Để trống Phẩm chất, Năng lực.'}${K.tichHop ? ' Ghi phần Tích hợp.' : ' Để trống Tích hợp.'}${K.diaDiem ? ' Ghi Địa điểm tổ chức.' : ' Để trống Địa điểm.'}${r.kind === 'goc' ? ' Để trống Lĩnh vực; tên hoạt động là danh sách các góc chơi của ngày, mỗi góc một dòng.' : ''}`;
}

const cut = (v, n = 400) => String(v ?? '').slice(0, n);

// ---------- KH chủ đề: Nội dung và Hoạt động cho từng mục tiêu của chủ đề nhánh ----------
const TOPIC_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['rows', 'note'],
  properties: {
    rows: { type: 'array', description: 'Mỗi mục tiêu đã cho đúng một phần tử, giữ nguyên mã và thứ tự', items: { type: 'object', additionalProperties: false, required: ['code', 'noiDung', 'hoatDong'], properties: {
      code: { type: 'string' },
      noiDung: { type: 'string', description: 'Nội dung giáo dục thực hiện mục tiêu, gắn chủ đề nhánh; mỗi ý một dòng bắt đầu bằng "- "' },
      hoatDong: { type: 'string', description: 'Các hoạt động tổ chức cho trẻ (ghi rõ loại hoạt động: hoạt động học, chơi ngoài trời, chơi trong lớp, sinh hoạt chiều, hoạt động khác); mỗi ý một dòng bắt đầu bằng "- "' },
    } } },
    note: { type: 'string', description: 'Một câu ngắn gửi giáo viên về điều cần lưu ý; có thể để trống' },
  },
};

const TOPIC_SYSTEM = `Bạn là giáo viên 10 năm kinh nghiệm, đã nắm chắc kiến thức tài liệu về chương trình giáo dục mầm non thí điểm. Hãy dựa trên tài liệu liên quan đến Quyết định 388 của Bộ Giáo dục và Đào tạo về chương trình giáo dục mầm non thí điểm, các module 1 đến 6 trong tài liệu chương trình giáo dục mầm non thí điểm. Từ những tài liệu đó, bạn hãy viết Nội dung và Hoạt động cho phù hợp với lứa tuổi trẻ, phù hợp với yêu cầu cần đạt và mục tiêu của chủ đề này.

Bạn soạn kế hoạch chủ đề cho một lớp của Trường Mầm non Hoa Hồng. Viết tiếng Việt, cô đọng, đúng văn phong kế hoạch giáo dục giáo viên mầm non vẫn ghi:
- Đi từ yêu cầu cần đạt và mục tiêu: trẻ cần đạt gì, rồi chọn nội dung và hoạt động giúp trẻ đạt được. Nội dung bám sát chủ đề nhánh.
- Lấy trẻ làm trung tâm, học qua chơi và trải nghiệm; hoạt động đa dạng (hoạt động học, chơi ngoài trời, chơi trong lớp, sinh hoạt chiều, lao động, trò chuyện), an toàn, khả thi ở lớp mầm non công lập.
- Đúng độ tuổi. Với nhà trẻ (dưới 36 tháng): không làm quen chữ cái, không đếm số lớn, không tập viết; chọn nhận biết, vận động, nghe hát, xem tranh, chơi với đồ vật.
- Mỗi mục tiêu 2 đến 4 ý nội dung và 2 đến 4 ý hoạt động. Nếu giáo viên đã ghi nội dung hoặc hoạt động thì giữ và bổ sung cho đủ, không bỏ ý của giáo viên.`;

function topicPrompt(r) {
  const goals = (Array.isArray(r.goals) ? r.goals : []).slice(0, 40).map(g =>
    `- ${cut(g.code, 20)} (${cut(g.domain, 40)}): ${cut(g.name) || '(chưa có tên mục tiêu)'}` +
    (g.yccd && g.yccd !== g.name ? `\n  Yêu cầu cần đạt: ${cut(g.yccd)}` : '') +
    (g.content ? `\n  Nội dung giáo viên đã ghi: ${cut(g.content)}` : '') +
    (g.activity ? `\n  Hoạt động giáo viên đã ghi: ${cut(g.activity)}` : '')).join('\n');
  return `Viết Nội dung và Hoạt động cho kế hoạch chủ đề của lớp ${cut(r.cls, 60)} (${cut(r.block, 80)}; độ tuổi ${cut(r.age, 10)}).
Chủ đề lớn: ${cut(r.topic, 120)} (${cut(r.topicFrom, 12)} – ${cut(r.topicTo, 12)}). Chủ đề nhánh tuần ${cut(r.week, 5)}: ${cut(r.sub, 120)} (${cut(r.from, 12)} – ${cut(r.to, 12)}).
Các mục tiêu của chủ đề nhánh:
${goals || '(chưa có)'}`;
}

const EVAL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['rows', 'note'],
  properties: {
    rows: { type: 'array', description: 'Các dòng kế hoạch đánh giá, xếp theo ngày', items: { type: 'object', additionalProperties: false, required: ['cls', 'date', 'kind'], properties: {
      cls: { type: 'string', description: 'Mã lớp, đúng một mã trong danh sách lớp' },
      date: { type: 'string', description: 'Ngày kiểm tra dạng YYYY-MM-DD, phải là một ngày có trong kế hoạch tuần của lớp này' },
      kind: { type: 'string', enum: ['hdh', 'ngoaiTroi', 'gocNgay', 'chieu'], description: 'Mã loại hoạt động ghi trong ngoặc vuông ở đầu dòng hoạt động của ngày đó' } } } },
    note: { type: 'string', description: 'Một câu ngắn gửi Ban giám hiệu về điều cần lưu ý; có thể để trống' },
  },
};

const EVAL_SYSTEM = `Bạn là cán bộ quản lý mầm non giàu kinh nghiệm, nắm chắc Chương trình giáo dục mầm non thí điểm theo Quyết định 388 của Bộ Giáo dục và Đào tạo. Bạn giúp Ban giám hiệu Trường Mầm non Hoa Hồng lập kế hoạch kiểm tra, đánh giá hoạt động giáo dục của các lớp trong một chủ đề: mỗi dòng là một lớp, một ngày kiểm tra và hoạt động được kiểm tra.
Quy tắc bắt buộc:
- Mỗi dòng chọn một lớp, một ngày có trong kế hoạch tuần của lớp đó, và mã loại hoạt động (trong ngoặc vuông) của một hoạt động có ở đúng ngày đó. Không chọn ngày hay loại hoạt động không có trong danh sách. App sẽ tự chép nguyên văn hoạt động từ kế hoạch tuần.
- Làm đúng yêu cầu của Ban giám hiệu (số lần, loại hoạt động, tuần nào…). Chỗ nào yêu cầu không nói thì chọn hợp lý: rải đều các tuần, tránh để Ban giám hiệu kiểm tra hai lớp cùng một buổi nếu không cần.
Viết tiếng Việt.`;

function evalPrompt(r) {
  const subs = (Array.isArray(r.subs) ? r.subs : []).slice(0, 20).map(x => `- Tuần ${cut(x.week, 5)}: ${cut(x.name, 120)} (${cut(x.from, 12)} – ${cut(x.to, 12)})`).join('\n');
  const cls = (Array.isArray(r.classes) ? r.classes : []).slice(0, 20).map(c => `Lớp ${cut(c.name, 60)} (mã ${cut(c.code, 20)}${c.age ? `, ${cut(c.age, 30)}` : ''}):\n` +
    (Array.isArray(c.days) ? c.days : []).slice(0, 60).map(d => `  * ${cut(d.date, 10)} (${cut(d.thu, 10)}, tuần ${cut(d.week, 5)}):\n` + (Array.isArray(d.acts) ? d.acts : []).slice(0, 6).map(a => `    - ${cut(a, 160).replace(/\n+/g, '; ')}`).join('\n')).join('\n')).join('\n');
  return `Lập kế hoạch đánh giá cho khối ${cut(r.block, 30)}.
Chủ đề lớn: ${cut(r.topic, 120)} (${cut(r.topicFrom, 12)} – ${cut(r.topicTo, 12)}).
Các chủ đề nhánh:
${subs || '(chưa có)'}
Kế hoạch tuần của từng lớp, theo ngày (chỉ được chọn trong danh sách này):
${cls || '(chưa có)'}
Yêu cầu của Ban giám hiệu:
${cut(r.ask, 3000)}`;
}

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
    // 404: Rules đã cho đọc nhưng tài liệu chưa có, vẫn là tài khoản hợp lệ.
    if (!check.ok && check.status !== 404) {
      if (check.status === 429) return json({ error: 'Firebase của trường đã hết lượt đọc miễn phí trong ngày nên chưa kiểm tra được tài khoản. Cô đợi đến khoảng 14 giờ (giờ Việt Nam) khi Firebase đặt lại lượt, hoặc nâng Firebase lên gói Blaze.' }, 503);
      if (check.status === 401) return json({ error: 'Phiên đăng nhập đã hết hạn, cô tải lại trang rồi thử lại.' }, 401);
      if (check.status === 403) return json({ error: 'Tài khoản chưa được dùng chức năng AI' }, 403);
      return json({ error: `Không kiểm tra được tài khoản (Firebase báo lỗi ${check.status}), cô thử lại sau.` }, 502);
    }
    const cfg = check.ok ? await check.json().catch(() => ({})) : {};
    const want = cfg?.fields?.aiModel?.stringValue;
    const model = MODELS[want] ? want : MODEL;

    let req;
    try { req = await request.json(); } catch { return json({ error: 'Dữ liệu gửi lên không đúng' }, 400); }
    const lesson = req.task === 'dayLesson', topic = req.task === 'topicPlan', evalp = req.task === 'evalPlan';
    if (req.task !== 'weekPlan' && !topic && !evalp && !(lesson && GA_KIND[req.kind])) return json({ error: 'Chưa hỗ trợ yêu cầu này' }, 400);

    if (!env.ANTHROPIC_API_KEY) return json({ error: 'Máy chủ chưa có khóa AI: vào Settings → Variables and Secrets thêm ANTHROPIC_API_KEY' }, 500);

    let res;
    try {
    // Haiku không có mô hình dự phòng phía máy chủ nên chỉ Opus, Sonnet gửi kèm fallbacks.
    const haiku = model === 'claude-haiku-5-5';
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        ...(haiku ? {} : { 'anthropic-beta': 'server-side-fallback-2026-07-01' }),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        ...(haiku ? {} : { fallbacks: 'default' }),
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: evalp ? EVAL_SCHEMA : topic ? TOPIC_SCHEMA : lesson ? LESSON_SCHEMA : SCHEMA } },
        system: evalp ? EVAL_SYSTEM : topic ? TOPIC_SYSTEM : lesson ? LESSON_SYSTEM : SYSTEM,
        messages: [{ role: 'user', content: evalp ? evalPrompt(req) : topic ? topicPrompt(req) : lesson ? lessonPrompt(req) : userPrompt(req) }],
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
    const [pin, pout] = MODELS[msg.model] || MODELS[model];
    const u = msg.usage || {};
    const cost = ((u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1) * pin / 1e6 + (u.output_tokens || 0) * pout / 1e6;
    return json({ plan, model: msg.model, usage: msg.usage, cost: Math.round(cost * 10000) / 10000 });
  },
};
