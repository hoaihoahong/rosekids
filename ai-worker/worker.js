// Máy chủ AI của RoseKids (Cloudflare Worker): soạn KH chủ đề, Kế hoạch tuần, Kế hoạch thể dục sáng, Giáo án ngày, KH đánh giá, nhận xét Phiếu kết quả đánh giá trẻ và chuyển đổi, rà soát file KH tuần, GA giáo viên soạn theo mẫu riêng, có nạp kỹ năng soạn GA, KH theo Chương trình GDMN thí điểm (QĐ 388).
// Khóa Anthropic cất trong biến bí mật ANTHROPIC_API_KEY của Worker, giáo viên không nhìn thấy.
// Chỉ tài khoản đang hoạt động của app (đọc được settings/ai trên Firestore) mới gọi được.
// Viết bằng fetch thuần vì trình soạn Worker trên trang Cloudflare không cài được gói npm.

const FIREBASE_PROJECT = 'rosekids-32f0c';
const ALLOWED_ORIGIN = 'https://hoaihoahong.github.io';
// Mô hình AI: Ban giám hiệu chọn trong Bảng tham số (settings/ai.aiModel); để trống thì dùng Opus như trước.
// Giá Anthropic (USD cho 1 triệu token: đầu vào, đầu ra, đọc bộ nhớ đệm), dùng để báo chi phí mỗi lượt.
const MODELS = {
  'claude-opus-5-5': [4, 20, 0.2],
  'claude-sonnet-5-5': [2, 10, 0.2],
  'claude-haiku-5-5': [0.1, 0.5, 0.01],
};
const MODEL = 'claude-opus-5-5';
// Việc ngắn, theo khuôn (nhận xét phiếu, đánh giá năng lực, KH đánh giá, KH thể dục sáng) không cần mô hình mạnh nhất:
// dùng tối đa Sonnet với mức suy nghĩ thấp. Ban giám hiệu chọn mô hình rẻ hơn thì theo lựa chọn đó.
// Giáo án, KH tuần, KH chủ đề vẫn dùng mô hình Ban giám hiệu chọn, mức suy nghĩ vừa.
const LIGHT = { childReport: 'claude-sonnet-5-5', childCompetency: 'claude-sonnet-5-5', childFull: 'claude-sonnet-5-5', evalPlan: 'claude-sonnet-5-5', morningPlan: 'claude-sonnet-5-5', importDoc: 'claude-sonnet-5-5', gaReview: 'claude-sonnet-5-5' };
const pickModel = (want, task) => {
  const m = MODELS[want] ? want : MODEL, cap = LIGHT[task];
  return cap && MODELS[cap][0] < MODELS[m][0] ? cap : m;
};

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

// ---------- Kế hoạch thể dục sáng: theo tháng, mỗi tuần một bộ động tác ----------
const TDS_KEYS = ['khoiDong', 'hoHap', 'tay', 'bung', 'chan', 'bat', 'hoiTinh', 'nhacKD', 'nhacBT', 'nhacHT'];
const TDS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['mucDich', 'chuanBi', 'weeks', 'note'],
  properties: {
    mucDich: { type: 'string', description: 'Mục đích – yêu cầu của cả tháng, 3 đến 4 ý, mỗi ý một dòng bắt đầu bằng "- "' },
    chuanBi: { type: 'string', description: 'Chuẩn bị (sân tập, nhạc, dụng cụ, trang phục), mỗi ý một dòng bắt đầu bằng "- "' },
    weeks: { type: 'array', description: 'Đúng số tuần đã cho, theo thứ tự', items: { type: 'object', additionalProperties: false, required: TDS_KEYS, properties: {
      khoiDong: { type: 'string', description: 'Khởi động: các kiểu đi, chạy theo hiệu lệnh hoặc nhạc rồi về đội hình tập' },
      hoHap: { type: 'string', description: 'Động tác hô hấp, kèm số lần và nhịp' },
      tay: { type: 'string', description: 'Động tác tay – vai, kèm số lần và nhịp' },
      bung: { type: 'string', description: 'Động tác bụng – lườn, kèm số lần và nhịp' },
      chan: { type: 'string', description: 'Động tác chân, kèm số lần và nhịp' },
      bat: { type: 'string', description: 'Động tác bật, kèm số lần và nhịp' },
      hoiTinh: { type: 'string', description: 'Hồi tĩnh: đi nhẹ nhàng, hít thở, thả lỏng' },
      nhacKD: { type: 'string', description: 'Tên bài hát, bản nhạc cho phần khởi động (không ghi link)' },
      nhacBT: { type: 'string', description: 'Tên bài hát, bản nhạc cho bài tập chung (trọng động), phù hợp độ tuổi và chủ đề (không ghi link)' },
      nhacHT: { type: 'string', description: 'Tên bài hát, bản nhạc nhẹ nhàng cho phần hồi tĩnh (không ghi link)' },
    } } },
    note: { type: 'string', description: 'Một câu ngắn gửi giáo viên về điều cần lưu ý; có thể để trống' },
  },
};

const TDS_SYSTEM = `Bạn là giáo viên mầm non 10 năm kinh nghiệm, phụ trách thể dục sáng của Trường Mầm non Hoa Hồng, nắm chắc Chương trình giáo dục mầm non thí điểm (Quyết định 388) và bài tập phát triển chung (BTPTC). Bạn soạn kế hoạch thể dục sáng một tháng: mỗi tuần một bộ động tác gồm khởi động, trọng động (hô hấp, tay – vai, bụng – lườn, chân, bật), hồi tĩnh và ba bài nhạc tập: nhạc khởi động, nhạc bài tập chung, nhạc hồi tĩnh (chỉ ghi tên bài, giáo viên tự chèn link).
Quy tắc:
- Đúng độ tuổi. Nhà trẻ: động tác đơn giản, mô phỏng con vật, đồ vật (gà vỗ cánh, thổi bóng, máy bay…), tập theo cô, 2 – 3 lần mỗi động tác, không bắt tập đều nhịp. Mầm 3 – 4 tuổi: 2 lần × 4 nhịp. Chồi, Lá: 2 lần × 8 nhịp hoặc 4 lần × 4 nhịp, phối hợp tay chân, có dụng cụ (nơ, vòng, gậy).
- Ghi động tác cụ thể, ngắn gọn như giáo viên vẫn ghi (vd "Tay 1: Hai tay đưa lên cao, ra trước, dang ngang – 2l × 8n"); chuẩn bị tư thế ban đầu khi cần.
- Tuần sau có thể giữ một phần động tác của tuần trước để trẻ thuần thục, nhưng thay ít nhất 1 – 2 động tác hoặc dụng cụ, đổi bài hát để trẻ hứng thú.
- Có thể lồng vận động theo câu chuyện, bài hát, mô phỏng con vật, yoga trẻ em; gắn chủ đề trong tháng khi phù hợp, không gò ép.
- An toàn: khởi động kỹ, nội dung vừa sức, cô quan sát và điều chỉnh với trẻ mệt; sân tập thông thoáng.
- Bài hát, nhạc chọn bài thiếu nhi quen thuộc, vui tươi, đúng độ tuổi.
Viết tiếng Việt.`;

function tdsPrompt(r) {
  const weeks = (Array.isArray(r.weeks) ? r.weeks : []).slice(0, 6).map((w, i) => `- ${w.week ? `Tuần ${cut(w.week, 5)}` : `Tuần thứ ${i + 1} của tháng`}: ${cut(w.from, 12)} – ${cut(w.to, 12)}`).join('\n');
  const topics = (Array.isArray(r.topics) ? r.topics : []).slice(0, 6).map(t => `- ${cut(t, 160)}`).join('\n');
  return `Soạn kế hoạch thể dục sáng ${cut(r.month, 20)} cho ${cut(r.cls, 60)} (${cut(r.block, 80)}${r.age ? `; độ tuổi ${cut(r.age, 60)}` : ''}).
Các tuần trong tháng (trả về đúng ${(Array.isArray(r.weeks) ? r.weeks : []).slice(0, 6).length} tuần theo thứ tự này):
${weeks}${topics ? `\nChủ đề lớp học trong tháng:\n${topics}` : ''}`;
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
    (Array.isArray(c.days) ? c.days : []).slice(0, 60).map(d => `  * ${cut(d.date, 10)} (${cut(d.thu, 10)}, tuần ${cut(d.week, 5)}):\n` + (Array.isArray(d.acts) ? d.acts : []).slice(0, 6).map(a => `    - ${cut(String(a ?? '').replace(/\n+/g, '; '), 70)}`).join('\n')).join('\n')).join('\n');
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

// ---------- Kỹ năng soạn GA, KH ----------
// Chép từ bộ tài liệu chuẩn Chương trình GDMN thí điểm (QĐ 388) trong thư mục chung của dự án:
// rosekids/tai-lieu-ctgdmn/08-ky-nang-soan-giao-an.md và 09-ky-nang-soan-ke-hoach.md. Sửa tài liệu thì chép lại vào đây.
// Gửi kèm lời dặn hệ thống, có đánh dấu bộ nhớ đệm để các lượt soạn sau đọc lại với giá 1/10.
const SKILL_GA = `KỸ NĂNG SOẠN GIÁO ÁN của Trường Mầm non Hoa Hồng (tài liệu chuẩn tổng hợp từ Chương trình QĐ 388 và 6 chuyên đề tập huấn). Áp dụng đầy đủ tư duy và quy tắc dưới đây khi soạn. Hình thức trả lời vẫn theo đúng các trường JSON, tên bước và văn phong mẫu của trường đã nêu ở trên; ý nào không có ô riêng (phân hoá, lưu ý an toàn, đánh giá) thì lồng vào Chuẩn bị, Tiến trình hoặc ghi chú cho giáo viên. Ký hiệu trong ngoặc vuông là nguồn, không chép vào giáo án.

# 08. KỸ NĂNG SOẠN GIÁO ÁN (GA) THEO CHƯƠNG TRÌNH GDMN THÍ ĐIỂM

> Bản chắt lọc dành cho AI của RoseKids (máy chủ AI soạn "Giáo án ngày"). Tổng hợp từ: Chương trình QĐ 388 (file 01) và Chuyên đề 1–6 (file 02–07). Mỗi quy tắc ghi nguồn trong ngoặc vuông.
> Thứ tự ưu tiên khi có mâu thuẫn: **(1) Chương trình QĐ 388 → (2) mẫu của Trường MN Hoa Hồng → (3) tài liệu tập huấn**.

---

## A. TƯ DUY CỐT LÕI (đọc trước khi soạn bất kỳ GA nào)

1. **Đi từ YCCĐ, không đi từ bài dạy.** Trình tự bắt buộc: YCCĐ (mã) → mục tiêu của độ tuổi/lớp → mục tiêu hoạt động → nội dung (trẻ cần trải nghiệm gì) → phương pháp, hình thức → chuẩn bị môi trường → tiến trình → đánh giá. [CĐ1; CĐ2; CĐ4 §2–3]
2. **Câu hỏi đổi:** không hỏi "trẻ cần biết kiến thức gì?" mà hỏi **"trẻ cần trải nghiệm, làm gì để đạt được?"**. Nội dung là **tình huống, nhiệm vụ, trải nghiệm**, không phải kiến thức đơn lẻ. [CĐ4 §3]
3. **Trẻ là chủ thể, cô tổ chức – hỗ trợ – dẫn dắt.** Trẻ được lựa chọn, làm thật, nói về cách làm, thử lại, vận dụng. Cô **nói ít, hỏi mở, không làm thay, không đưa đáp án ngay**. [CT388 B.1; CĐ4 §4]
4. **Tích hợp có chủ đích**, không ghép nối cơ học: xác định **1 lĩnh vực/năng lực trung tâm** + 2–4 lĩnh vực tích hợp hỗ trợ. [CĐ4 §7.3; CĐ3]
5. **Phẩm chất, năng lực không dạy thành bài riêng**; mỗi hoạt động chọn **năng lực trọng tâm**, tránh ôm đồm. [CĐ4 §2.3]
6. **Không so sánh, không xếp loại, không ép buộc.** Khen cụ thể vào hành động, sự cố gắng, cách làm. [CT388 D.3.2; CĐ4 §4.5]
7. **Không dạy trước chương trình lớp 1** (không dạy đọc, viết, tính kiểu tiểu học); trẻ 5 tuổi chuẩn bị qua "sẵn sàng học đọc, học viết" và trải nghiệm mô phỏng. [CĐ1; CT388 Phần ba C.2]

---

## B. VIẾT MỤC TIÊU

### B1. Công thức
> **Mục tiêu = (Mã YCCĐ) + Trẻ + động từ hành động quan sát được + nội dung + tình huống/điều kiện + mức hỗ trợ hoặc mức chủ động.** [CĐ4 §2.5; CĐ2 tr.41]

- Mỗi mục tiêu **truy được về một mã YCCĐ** (TC/TX/NN/NT/NgT x.y) của **đúng độ tuổi**. Không chắc mã → ghi "(đối chiếu chương trình)", **không bịa mã**. [CĐ2 8.1; CĐ3 §10.4]
- **Không chép nguyên YCCĐ cuối độ tuổi** làm mục tiêu cho lớp nhỏ hơn hoặc cho một hoạt động: YCCĐ là **đích**; mục tiêu hoạt động phải cụ thể hơn, vừa sức hơn. [CĐ2 8.1.1; CĐ4 §2.2]
- **Cấm** động từ không quan sát được đứng một mình: *hiểu, biết, nắm được, cảm nhận được, phát triển năng lực…*. Nếu dùng "biết" phải kèm hành vi ("biết nói 'cho tớ mượn' khi cần đồ chơi của bạn"). [CĐ2 8.1.5; CĐ4 §2.7]
  - ✗ "Trẻ phát triển năng lực hợp tác." · "Trẻ biết về các loại quả."
  - ✓ "TX6.4: Trẻ cùng 2–3 bạn phân chia vật liệu và hoàn thành một sản phẩm chung, có sự gợi ý của cô khi cần." · "Trẻ gọi tên và phân biệt được 3–5 loại quả có hạt và không hạt."
- 4 câu tự kiểm: (1) xuất phát từ YCCĐ nào? (2) trẻ làm hành động gì? (3) quan sát được không? (4) vừa với khả năng hiện tại của trẻ không? [CĐ4 §2.7]

### B2. Động từ theo độ tuổi [CĐ2 8.1.4]
| Tuổi | Động từ gợi ý |
|---|---|
| 3–12 tháng | chú ý, phản ứng, nhìn theo, nhận ra |
| 12–24 tháng | nhận biết, chỉ, gọi tên, bắt chước |
| 24–36 tháng | gọi tên, phân biệt, lựa chọn, làm theo |
| 3–4 tuổi (Mầm) | nhận biết, mô tả đơn giản, so sánh đơn giản |
| 4–5 tuổi (Chồi) | so sánh, phân loại, giải thích đơn giản |
| 5–6 tuổi (Lá) | vận dụng, suy luận đơn giản, giải quyết tình huống, đề xuất, điều chỉnh |

### B3. Thang mức độ (đưa vào câu mục tiêu)
- Mẫu giáo: **Được hướng dẫn trực tiếp → Thực hiện khi được gợi ý → Tương đối chủ động → Biết điều chỉnh**. [CĐ4 §2.5]
- Nhà trẻ: **Cảm nhận → Phản ứng → Bắt chước → Thực hiện**. Mẫu giáo theo năm học: **Nhận biết → Thực hiện → Vận dụng → Tự chủ**. [CĐ2 8.1.7]
- Ví dụ cùng TX6.4: 3–4 tuổi "…cùng bạn làm sản phẩm **với sự hướng dẫn, hỗ trợ trực tiếp của cô**"; 4–5 tuổi "…phối hợp với bạn **trong tình huống quen thuộc, có gợi ý khi cần**"; 5–6 tuổi "…**chủ động lựa chọn** phần việc, trao đổi… **biết điều chỉnh** cách phối hợp khi cần". [CĐ4 §2.5]

### B4. Số lượng và bố cục mục tiêu trong một GA
- **3–5 mục tiêu** (app hiện yêu cầu 4–6), mỗi mục tiêu một câu bắt đầu bằng "Trẻ …".
- Phủ: lĩnh vực trung tâm (kiến thức – kỹ năng cụ thể) → quá trình nhận thức/ngôn ngữ (trẻ nói được câu/từ gì) → thái độ + năng lực chung (giao tiếp, hợp tác, tự lực, GQVĐ, thích ứng). [CĐ3 §7.1; CĐ1 B.9]
- Ghi **≥ 1 phẩm chất và ≥ 2 năng lực chung**, mỗi ý kèm **biểu hiện quan sát được trong chính hoạt động này** (vd "Hợp tác: trẻ thay phiên dùng chung kéo, keo trong nhóm 3–4 bạn"). [CĐ1 B.8]
- Tên đúng: 4 phẩm chất **Yêu thương, Tôn trọng, Trung thực, Trách nhiệm**; 5 năng lực **Giao tiếp, Hợp tác, Tự lực, Giải quyết vấn đề, Thích ứng**. Không dùng "tự chủ", "sáng tạo" như năng lực chung. [CT388 C]

---

## C. CẤU TRÚC GIÁO ÁN

### C1. Phần đầu (mọi loại GA)
Tên hoạt động · Lĩnh vực trung tâm · Tích hợp · Lớp/độ tuổi · Chủ đề/nhánh (nếu có) · Thời lượng · Địa điểm (ngoài trời) · **Mục tiêu** · **Phẩm chất – Năng lực** · **Chuẩn bị** (không gian; đồ dùng của cô; đồ dùng của trẻ/nhóm, ưu tiên **vật thật, học liệu mở, vật liệu thiên nhiên – tái chế, địa phương**; **lưu ý an toàn – vệ sinh**). [CT388 D; CĐ1 D.23; CĐ5 C.16]

### C2. Tiến trình theo loại hoạt động

**① Hoạt động học – MẪU GIÁO: quy trình 5 bước** [CĐ4 §6.1; trùng mẫu trường]
| Bước | Tên trong mẫu trường | Việc phải có |
|---|---|---|
| 1 | Khởi động – Tạo tình huống học tập | Tình huống/nhiệm vụ có ý nghĩa (câu chuyện, trò chơi, vật thật, sự việc thực, câu hỏi gần gũi); trẻ dự đoán, chia sẻ kinh nghiệm; **không đưa đáp án**. |
| 2 | Khám phá – Trải nghiệm [Trải nghiệm trước] | **Nhiệm vụ mở** để trẻ **trực tiếp làm hành động nêu trong mục tiêu**; cá nhân/cặp/nhóm nhỏ; cô quan sát, hỏi gợi mở, **không làm thay**. |
| 3 | Chia sẻ – Hình thành kiến thức [Giải thích sau] | Trẻ/nhóm trình bày sản phẩm, cách làm, khó khăn, điều khám phá; bạn hỏi, bổ sung; **sau đó** cô kết nối, khái quát theo mục tiêu. |
| 4 | Thực hành – Vận dụng | **Tình huống mới** (đổi học liệu, không gian, bạn, yêu cầu); 1–2 trò chơi có luật rõ; khuyến khích cách làm mới. |
| 5 | Chia sẻ – Đánh giá | Trẻ **tự nhận xét, nhận xét bạn**; cô ghi nhận cụ thể; quan sát đối chiếu mục tiêu; cùng thu dọn; gợi ý vận dụng ở nhà/góc. |
> Điểm cần giữ: "trẻ được làm thật, nói thật về cách làm, thử lại và vận dụng trong tình huống mới". [CĐ4 slide]

**② Hoạt động học – NHÀ TRẺ** (dạng **chơi – tập**, 1–2 lần/ngày, **5–15 phút**) [CT388 Phần hai G.2.4.4; CĐ3 §7.1]
1. Tạo hứng thú và định hướng khám phá (cô giới thiệu **ngắn ~2 phút**)
2. Quan sát, trải nghiệm, khám phá đặc điểm (**vật thật**, 1–2 giác quan chính; trẻ khám phá 10–15 phút)
3. Thực hành, củng cố (trò chơi cho trẻ **lặp lại nhiều lần**: chọn theo yêu cầu, tìm giống nhau, ghép đôi, chỉ/gọi tên)
4. Vận dụng trong tình huống mới (góc chơi, sân, sinh hoạt: tìm đồ vật trong lớp, chọn cốc của mình…)
5. Củng cố, nhận xét, kết thúc (khen chung và cụ thể)
- Câu hỏi ngắn: "Đây là gì?", "Màu gì?", "To hay nhỏ?". Cá nhân/nhóm nhỏ là chính. **Không** chữ cái, đếm số lớn, tập viết, hát đúng lời – đúng nhạc như trẻ lớn, sản phẩm giống mẫu. [CĐ3 §10]

**③ Thể chất – vận động** [CĐ3 §7.2; CĐ4 §9.1]
Khởi động → Trọng động: (a) bài tập phát triển chung (b) vận động cơ bản – **mỗi trẻ tập ≥ 2–3 lần**, có phân hoá độ khó (c) trò chơi vận động (mọi trẻ cùng chơi, **không thi thành tích**) → Hồi tĩnh. Mẫu giáo có thể tổ chức theo **5 bước hoạt động chơi** gắn câu chuyện (vd "Vượt chướng ngại vật mang thuốc cho bạn Gấu"). Ghi rõ an toàn: thảm, khoảng cách, dụng cụ.

**④ Âm nhạc** – Nhà trẻ: Gây hứng thú → Nghe & cảm nhận → Thể hiện & luyện tập → Trò chơi & thư giãn. [CĐ3 §7.4] Mẫu giáo: 5 bước, cho trẻ **thử nghiệm âm thanh, chọn nhạc cụ, sáng tạo cách biểu diễn** (vd "Ban nhạc nhí"). [CĐ4 GA mẫu 2]

**⑤ Tạo hình** – Đề tài **mở**, không làm mẫu toàn bộ, **không yêu cầu cả lớp cùng một sản phẩm theo một mẫu**; nhiều lựa chọn vật liệu, cách làm; trẻ đặt tên, giới thiệu sản phẩm; trưng bày sản phẩm. [CĐ1 C.15; CT388 Phần ba D]

**⑥ Hoạt động chơi (góc) – 5 bước mẫu giáo** [CĐ4 §6.2] (mẫu trường 4 bước tương ứng trong ngoặc)
1. Gợi hứng thú – hình thành và lựa chọn ý tưởng chơi *(Gây hứng thú)*
2. Thoả thuận – lập kế hoạch chơi: trẻ tự chọn góc, vai, bạn, phân công *(Thỏa thuận trước khi chơi)*
3. Thực hiện chơi: cô quan sát, nhập vai, gợi mở liên kết góc, **ghi nhận biểu hiện năng lực** *(Quá trình trẻ chơi)*
4. Mở rộng, phát triển trò chơi: thêm học liệu/tình huống, đổi vai *(gộp trong Quá trình trẻ chơi)*
5. Chia sẻ – đánh giá – kết thúc: trẻ tự nhận xét, nhận xét bạn, **cùng thu dọn** *(Nhận xét – kết thúc)*
- Mục tiêu chơi **định hướng môi trường và quan sát**, **không biến thành kịch bản bắt trẻ chơi theo**. Chủ đề là "sợi dây kết nối, không phải cái khuôn". [CĐ4 §6.2, §8.4]

**⑦ Hoạt động ngoài trời** (mẫu trường 4 bước) – Khởi động/tạo tình huống → Trò chơi có chủ đích (quan sát, khám phá thiên nhiên, TCVĐ, TCDG) → Chơi tự do (trẻ tự chọn, cô bao quát an toàn) → Kết thúc. Coi **tự nhiên là bối cảnh giáo dục**; ghi Địa điểm và an toàn (nắng, cây gai/mủ độc, nước, cát). [CT388 Phần ba C.3; CĐ3 §8.10]

**⑧ Hoạt động chiều** – 5 bước như hoạt động học nhưng **ngắn, nhẹ nhàng**; ưu tiên ôn – vận dụng, đọc sách, văn nghệ, chơi theo nhu cầu, **lao động** (MG: 10–30 phút/lần, ≥ 1–2 lần/tuần). [CT388 Phần ba G.2.4.3]

**⑨ Sinh hoạt (đón, ăn, ngủ, vệ sinh, trả trẻ)** – **không viết thành tiết học**; ghi 1 cơ hội giáo dục mỗi thời điểm (tự phục vụ, văn minh, dinh dưỡng, ngôn ngữ). Giờ ăn: trước – trong – sau. **Không** "ép ăn hết suất", **không làm thay** việc trẻ tự làm được. [CĐ4 §6.3; CĐ5 B]

### C3. Câu hỏi mở mẫu (dùng trong tiến trình)
"Điều gì đang xảy ra?" · "Vì sao con nghĩ như vậy?" · "Con có cách nào khác không?" · "Nếu làm lại, con sẽ thay đổi điều gì?" · "Nhóm mình sẽ chia việc thế nào?" · "Con thích nhất điều gì? Vì sao?" [CĐ4 §4.4]

### C4. Phản hồi của cô (viết vào bước 3, 5)
- Mô tả hành động → ghi nhận cố gắng/cách giải quyết → giúp trẻ nhận ra nguyên nhân → hỏi để trẻ tự nhận xét → gợi ý lần sau. [CĐ4 §4.5]
- ✓ "Hai con đã tìm được cách thay phiên nhau dùng chiếc kéo." ✗ "Con giỏi quá!", "Bạn này làm tốt hơn."

---

## D. PHÂN HOÁ – HỖ TRỢ CÁ NHÂN – HOÀ NHẬP

1. Mỗi GA có **phân hoá trong cùng một mục tiêu** [CĐ4 §4.6; CĐ6 B.6]:
   | Nhóm trẻ | Cách điều chỉnh |
   |---|---|
   | Cần hỗ trợ | chọn giữa 2 phương án; tranh/vật mẫu; chia bước nhỏ; ghép bạn hỗ trợ; cô hướng dẫn trực tiếp |
   | Phù hợp | tự đề xuất, thực hiện phương án; cô gợi ý khi cần |
   | Thực hiện tốt | so sánh nhiều phương án, giải thích, tình huống mới, hỗ trợ bạn (**không làm thay bạn**) |
2. Giảm dần hỗ trợ: chưa biết → làm mẫu ngắn, chia bước; biết bước đầu → câu hỏi, tranh gợi ý; làm được → nhiệm vụ mở; chủ động → tăng thử thách. [CĐ4 §4.1]
3. Có trẻ hoà nhập: thêm mục **"Dự đoán rào cản & phương án UDL"**; nội dung qua **≥ 2–3 kênh** (lời + hình/vật thật + thao tác); lời hướng dẫn **một bước một mệnh lệnh**; đánh giá chấp nhận nhiều cách thể hiện (nói, chỉ, chọn thẻ, sản phẩm); trẻ **không bị loại khỏi hoạt động chung** (đổi vai, đổi tiêu chí sản phẩm). [CĐ6 C, D]
4. **Không dùng nhãn chẩn đoán** ("trẻ tự kỷ", "trẻ tăng động", "bạn đặc biệt"); mô tả hành vi/nhu cầu; phần điều chỉnh cá nhân để **ghi chú nội bộ**, không đưa lên văn bản công khai. [CĐ6 A]

---

## E. ĐÁNH GIÁ TRONG GA

- Đánh giá **quá trình**: quan sát hành động đối chiếu mục tiêu và **biểu hiện dự kiến**, không chỉ sản phẩm cuối; kết hợp trò chuyện, sản phẩm, lời giải thích, **tự nhận xét và nhận xét bạn** (mẫu giáo). [CĐ4 §6.1 B5; CT388 E]
- **Không dùng bài tập hay câu hỏi kiểm tra trẻ** (nhà trẻ), không đánh giá đúng/sai, không so sánh trẻ. [CT388 Phần hai E.1.3]
- Ghi: trẻ làm được gì, trong hình thức nào, cần hỗ trợ gì → **điều chỉnh** hoạt động sau. [CĐ4 §6.1]
- Nhận xét cuối ngày 3 mục: **sức khoẻ · cảm xúc – thái độ – hành vi · kiến thức – kỹ năng**. [CĐ3 §10.30; CĐ4 bảng mẫu 3]

---

## F. AN TOÀN – THỜI LƯỢNG – NGÔN TỪ

- Mỗi GA có **lưu ý an toàn cụ thể** theo nguy cơ (hóc/sặc vật nhỏ, hạt; vật sắc nhọn; trơn trượt; nắng; nước; cát; cây độc; thiết bị số – kiểm soát thời lượng). **Không bỏ hoạt động ngoài trời vì sợ rủi ro**, mà ghi biện pháp. [CĐ5 C; CĐ3 §10.24]
- Thời lượng: **nhà trẻ 5–15 phút**; **mẫu giáo tối thiểu 25–30 phút** cho hoạt động học có chủ đích (tuỳ độ tuổi, hứng thú). [CT388] (GA mẫu CĐ4 cho 3–4 tuổi ghi 20–25 phút → khi soạn Mầm ghi "20–25 phút, linh hoạt theo hứng thú").
- **Không cả lớp quá lâu**: cả lớp giao nhiệm vụ → nhóm nhỏ → cá nhân → cả lớp chia sẻ. Xen kẽ **động – tĩnh**. [CĐ4 §5]
- Từ cấm trong GA: *ép, bắt buộc, phạt, chê, so sánh, cho ra ngoài, bé ngoan/hư (so sánh)*. Thay bằng *khuyến khích, gợi mở, hỗ trợ, động viên*. Ngôn ngữ **trung tính về giới**. [CĐ3 §10.35–36; CĐ6 C.18]

---

## G. CHECKLIST TRƯỚC KHI XUẤT GA
☐ Mỗi mục tiêu có mã YCCĐ đúng độ tuổi, động từ quan sát được, có mức hỗ trợ/chủ động.
☐ Có ≥ 1 phẩm chất, ≥ 2 năng lực chung kèm biểu hiện trong hoạt động.
☐ Bước 2 trẻ **làm trước**, bước 3 cô **khái quát sau**; có câu hỏi mở; cô không làm thay.
☐ Có tình huống vận dụng mới; có phân hoá 3 mức; có lựa chọn cho trẻ.
☐ Chuẩn bị đủ học liệu thật/mở cho mọi trẻ; có lưu ý an toàn.
☐ Đánh giá bằng quan sát, có trẻ tự nhận xét (MG); không so sánh, không chấm đúng/sai.
☐ Đúng độ tuổi (nhà trẻ không chữ, số lớn, tập viết; MG không dạy trước lớp 1).
☐ Thời lượng đúng; động – tĩnh hài hoà; không cả lớp quá lâu.
☐ Không có từ ngữ cấm, nhãn chẩn đoán, thông tin nhạy cảm của trẻ.`;

const SKILL_KH = `KỸ NĂNG SOẠN KẾ HOẠCH GIÁO DỤC của Trường Mầm non Hoa Hồng (tài liệu chuẩn tổng hợp từ Chương trình QĐ 388 và 6 chuyên đề tập huấn). Áp dụng đầy đủ tư duy và quy tắc dưới đây khi soạn. Hình thức trả lời vẫn theo đúng các trường JSON và mẫu của trường đã nêu ở trên: không thêm ô mới; mục không có ô riêng (phối hợp phụ huynh, an toàn, điều chỉnh) thì lồng vào ô gần nhất hoặc ghi chú cho giáo viên. Phần kế hoạch năm, kế hoạch ngày là kiến thức nền để kế hoạch đúng tinh thần, không phải soạn ra. Ký hiệu trong ngoặc vuông là nguồn, không chép vào kế hoạch.

# 09. KỸ NĂNG SOẠN KẾ HOẠCH GIÁO DỤC (năm – tháng/chủ đề – tuần – ngày)

> Bản chắt lọc dành cho AI của RoseKids (máy chủ AI soạn "KH chủ đề", "KH tuần", "KH đánh giá"). Nguồn: Chương trình QĐ 388 (file 01), Chuyên đề 2 (file 03 – phát triển chương trình, phân giải YCCĐ), Chuyên đề 3, 4 (file 04, 05 – lập KH nhà trẻ, mẫu giáo), Chuyên đề 5 (file 06 – chế độ sinh hoạt), Chuyên đề 6 (file 07 – hoà nhập).
> Thứ tự ưu tiên: **Chương trình QĐ 388 → mẫu của Trường MN Hoa Hồng → tài liệu tập huấn**.

---

## A. NGUYÊN TẮC CHUNG

1. **Liên thông các cấp:** Chương trình nhà trường → KH năm học → học kỳ → **tháng/chủ đề/dự án** → **tuần** → **ngày** → hoạt động. Mục tiêu cấp dưới **lấy từ** cấp trên và **cụ thể hơn**; không viết mục tiêu các cấp giống nhau. [CĐ2 8.3.21; CĐ4 §2.6]
2. **Bắt đầu từ trẻ:** KH không phải bản sao chương trình chung; căn cứ khả năng hiện tại ("vùng phát triển gần nhất"), nhu cầu, hứng thú của trẻ trong lớp, điều kiện lớp – trường, bối cảnh địa phương. [CĐ4 §8.1–8.2]
3. **Toàn diện, cân đối 5 lĩnh vực** (TC, TX, NN, NT, NgT) trong tháng/tuần; cả năm không bỏ sót lĩnh vực. [CĐ4 §8.3; CĐ3 §10.3]
4. **Tháng là khung thời gian; chủ đề/dự án là hình thức tổ chức, là "sợi dây kết nối", không phải cái khuôn.** Không phải hoạt động nào cũng "dính" tên chủ đề (vd bật xa, TCDG "Mèo đuổi chuột", rèn tự xúc cơm). [CĐ4 §8.3–8.4]
5. **Không chia đều máy móc**: mục tiêu quan trọng **lặp lại, nâng dần** qua nhiều chủ đề (đồng tâm); chừa thời gian **củng cố, hỗ trợ trẻ chưa đạt**, khoảng **dự phòng**; gắn mùa, ngày lễ, sự kiện địa phương. [CĐ2 8.3.22]
6. **Không cần đưa tất cả YCCĐ vào một chủ đề/tháng.** Một mục tiêu có thể thực hiện qua nhiều tuần, nhiều hoạt động. [CĐ4 §2.6]
7. **Linh hoạt, có điều chỉnh:** mỗi KH có mục **"Điều chỉnh/phát sinh"**; cân đối hoạt động theo KH của cô – theo ý thích trẻ – **phát sinh**. [CT388 C.3; CĐ2 8.3.23]
8. **Tinh gọn**, không phát sinh hồ sơ ngoài quy định; GV được chủ động chọn hình thức thể hiện KH. [CĐ4 §8.2.3]
9. **Phối hợp gia đình – cộng đồng** có mặt trong mọi KH chủ đề/tuần (việc cụ thể, hai chiều). [CT388 Phần năm VII; CĐ1 G.32; CĐ5 G.39]

---

## B. PHÂN GIẢI YCCĐ THÀNH MỤC TIÊU THEO ĐỘ TUỔI (việc của nhà trường/tổ chuyên môn)

- Chương trình chỉ có YCCĐ **cuối nhà trẻ (24–36 tháng)** và **cuối mẫu giáo (5–6 tuổi)**. Các độ tuổi khác: nhà trường **phân giải** thành mục tiêu giáo dục. [CT388; CĐ1 A.3]
- **4 bước phân giải** [CĐ2 – xem file 03 để có bảng ví dụ NN2.3, TC7.2, NT4.2, NgT3.2, TC6.4, TX4.5]: (1) đọc, phân tích YCCĐ (thành tố hành vi, nội dung, điều kiện); (2) xác định trình tự phát triển theo tuổi; (3) viết mục tiêu từng tuổi theo **Động từ + Nội dung + Điều kiện + Mức độ**; (4) rà soát tính liên thông, khả thi, đánh giá được.
- Mục tiêu tuổi sau **cao hơn** tuổi trước; tuổi nhỏ dùng "với sự hỗ trợ/hướng dẫn/khi được nhắc", tuổi lớn dùng "chủ động, tự, cùng bạn, điều chỉnh". [CĐ2 8.1.6–7]
- Trong app: mục tiêu đã phân giải của trường lưu theo mã (\`yccd/{tuổi}_{mã}\`); AI **dùng đúng mã và tên mục tiêu app gửi**, không tự đổi.

---

## C. KẾ HOẠCH NĂM HỌC (mẫu Phụ lục 2 – CĐ2)
I. Căn cứ (CT GDMN; YCCĐ đã phân giải; đặc điểm trẻ; điều kiện lớp/trường; bối cảnh địa phương)
II. Đặc điểm tình hình (quy mô, đội ngũ, trẻ, thuận lợi – khó khăn)
III. Mục tiêu theo nhóm tuổi (bảng YCCĐ cuối độ tuổi × mục tiêu từng nhóm tuổi, theo 5 lĩnh vực)
IV. Dự kiến nội dung, phương pháp, hình thức, điều kiện – **bảng 8 cột**: TT | Chủ đề/tháng/dự án/sự kiện | Thời gian (từ… đến…) | Nội dung | Phương pháp | Hình thức | Môi trường giáo dục | Điều chỉnh
V. Tổ chức thực hiện (phân công, phối hợp, kiểm tra)
VI. Đánh giá thực hiện KH (rà soát tháng, học kỳ, cuối năm)
- Năm học **35 tuần × 5 ngày**; đánh giá định kì **cuối HK1, cuối năm**; cân đo theo lịch (nhà trẻ < 24 th: hằng tháng; ≥ 24 th và MG: 3 tháng/lần); khám sức khoẻ đầu năm. [CT388; CĐ5 D]
- Lớp có trẻ khuyết tật: kèm **KHGDCN** cho từng trẻ (khả năng – nhu cầu; mục tiêu năm/học kỳ; nội dung, biện pháp, người thực hiện, thời gian; đánh giá, điều chỉnh); lịch rà soát. [CĐ6 E.22–29]

---

## D. KẾ HOẠCH THÁNG / CHỦ ĐỀ / DỰ ÁN – 3 bước [CĐ4 §8.3]

1. **Xác định, cụ thể hoá mục tiêu**: chọn mục tiêu trọng tâm từ KH năm → viết lại cụ thể cho tháng/chủ đề bằng động từ hành động.
   - Năm: "Trẻ biết phối hợp các kỹ năng tạo hình… tạo sản phẩm có bố cục, màu sắc hài hoà" → Tháng: "Trẻ phối hợp kỹ năng vẽ nét thẳng, nét xiên và dán để tạo hình ngôi nhà."
2. **Chọn nội dung tương ứng**: kiến thức – kỹ năng – thái độ **trẻ cần trải nghiệm** để đạt mục tiêu; cân đối 5 lĩnh vực; gắn địa phương; có mức nâng cao.
3. **Phân bổ nội dung vào các hình thức**: (a) **Hoạt động học có chủ đích**; (b) **Hoạt động sinh hoạt khác**: trò chuyện sáng, ngoài trời, góc, sinh hoạt chiều, ăn – ngủ – vệ sinh, lao động, lễ hội, tham quan.

**Bảng KH chủ đề (dạng app RoseKids dùng):** mỗi mục tiêu (mã) → **Nội dung** (2–4 ý, gạch đầu dòng) → **Hoạt động** (2–4 ý, ghi rõ loại: hoạt động học / chơi ngoài trời / chơi trong lớp / sinh hoạt chiều / hoạt động khác).
Ví dụ (MG 5–6 tuổi, dự án "Nước và các hiện tượng tự nhiên") [CĐ4 bảng mẫu 1]:
| Mục tiêu | Nội dung | Hoạt động |
|---|---|---|
| NT…: Trẻ gọi tên được một số chất tan, không tan trong nước qua thực hành thí nghiệm. | – Chất tan (bột cam, đường, màu nước), không tan (đất, cát)<br>– Kỹ năng làm thí nghiệm, quan sát đổi màu, vị<br>– Hiện tượng thấm nước | – Hoạt động học: thí nghiệm "Chất tan và không tan"<br>– Góc khám phá: chơi màu nước<br>– Sinh hoạt chiều: pha nước cam/chanh<br>– Ngoài trời: quan sát nước thấm sau mưa |

- Chủ đề tuần đi **từ gần gũi đến mở rộng**; lồng sự kiện trong tháng (20/11, Tết, Trung thu…). [CĐ3 §10.5]
- Nhà trẻ: KH tháng có thể kèm **mạng nội dung, mạng hoạt động**; mục tiêu phân theo nhóm tháng tuổi của lớp. [CĐ3 §7.6]

---

## E. KẾ HOẠCH TUẦN

### E1. Khung của Trường MN Hoa Hồng (app RoseKids – giữ nguyên)
Hàng: **Giờ sinh hoạt | Thứ hai … Thứ bảy**
| Hàng | Cách ghi |
|---|---|
| Mục tiêu | Mục tiêu của tuần (mã + tên), lấy từ KH chủ đề nhánh |
| Đón trẻ, ăn sáng | chung cả tuần |
| Thể dục sáng | theo KH TDS của trường (không soạn) |
| Hoạt động học | mỗi ngày 1 hoạt động, **dòng đầu ghi mã lĩnh vực** (thứ tự ưu tiên của trường: T2 NN, T3 TX, T4 NT, T5 TC, T6 NgT, T7 KNS) |
| Hoạt động ngoài trời | mỗi ngày 1 nội dung (quan sát/TCVĐ/TCDG + chơi tự do) |
| Hoạt động vui chơi trong lớp | theo ngày, 1–3 góc/ngày, mỗi góc một dòng nội dung; đổi góc giữa các ngày |
| Ăn – Ngủ – Vệ sinh | chung cả tuần, **ghi nội dung giáo dục** (không chỉ "cho trẻ ăn") |
| Sinh hoạt chiều | mỗi ngày 1 hoạt động; T7 thường lau rửa đồ chơi |
| Trả trẻ | chung cả tuần, có trao đổi phụ huynh |
> Chương trình thiết kế **5 ngày/tuần**; trường tổ chức thêm **Thứ bảy** (KNS) – AI giữ 6 cột theo mẫu trường.

### E2. Quy tắc soạn KH tuần [CĐ3 §10; CĐ4 §8.4; CĐ5 A]
1. **Mỗi mục tiêu tuần có ít nhất 1 hoạt động** thực hiện nó (học, ngoài trời, góc, chiều, sinh hoạt); **mỗi hoạt động phục vụ ít nhất 1 mục tiêu** – đối chiếu hai chiều. [CĐ2 8.2.11]
2. Hoạt động học đặt tên dạng **nhiệm vụ/tình huống** (vd "Thí nghiệm: vật chìm – vật nổi", "Làm biển tên góc chơi") thay cho tên bài kiểu cũ; có thể giữ ký hiệu quen của trường (LQCC, VĐTN…). [CĐ4 bảng mẫu 3 ghi chú]
3. **Mỗi ngày có chơi ngoài trời**; tăng hoạt động trong thiên nhiên. [CĐ3 §10.7; CT388]
4. Góc chơi: **thường xuyên đổi mới nội dung, luân chuyển đồ chơi**; ghi "Yêu cầu chung" + **"Biện pháp"** của cô (quan sát, tạo tình huống, gợi ý ý tưởng, chơi cùng trẻ). [CT388 Phần ba G.2.4.1; CĐ4 bảng mẫu 3]
5. **Cân đối động – tĩnh, trong lớp – ngoài trời, cả lớp – nhóm – cá nhân** trong từng ngày. [CĐ2 8.2.16]
6. Mẫu giáo: **lao động tự phục vụ ≥ 1–2 lần/tuần** (cất dọn, lau bàn ghế, tưới cây, nhặt lá…). [CT388]
7. Ăn – ngủ – vệ sinh: mỗi khung ghi **≥ 1 mục tiêu giáo dục** (tự phục vụ, dinh dưỡng, văn minh, an toàn); không "ép ăn". [CĐ5 B.9–12]
8. Có mục **phối hợp phụ huynh** cụ thể (sưu tầm học liệu, việc làm ở nhà, an toàn, thông tin sức khoẻ). [CĐ3 §10.9; CĐ5 G]
9. Có dòng **nhận xét cuối ngày** (sức khoẻ; cảm xúc – thái độ – hành vi; kiến thức – kỹ năng) và **điều chỉnh**. [CĐ4 bảng mẫu 3]
10. **Đúng độ tuổi**: nhà trẻ – nhận biết, vận động, nghe hát, xem tranh, chơi với đồ vật, thao tác vai; không chữ cái, đếm số lớn, tập viết. MG 5–6 tuổi: có trải nghiệm chuẩn bị vào lớp 1 nhưng **không dạy trước** đọc – viết – tính.
11. Trẻ hoà nhập: mục tiêu KHGDCN **xuất hiện lại trong KH tuần** ở ghi chú nội bộ (người thực hiện, thời điểm trong ngày); **không ghi tên/nhãn trẻ** trên bản KH công khai. [CĐ6 A.4, E.24]

---

## F. KẾ HOẠCH NGÀY / CHẾ ĐỘ SINH HOẠT [CT388 G.2; CĐ5 A]

- Đủ **5 khối**: (1) đầu ngày – đón, chơi, thể dục sáng, trò chuyện; (2) ăn, ngủ, vệ sinh; (3) chơi – góc, ngoài trời, tự do; (4) học; (5) cuối ngày – trò chuyện, chơi, trả trẻ.
- **Không tự bịa khung giờ**: dùng thời gian biểu của trường; nếu phải đề xuất, ghi "gợi ý, nhà trường điều chỉnh". Chương trình **không quy định giờ cứng** cho từng hoạt động, chỉ yêu cầu đủ, linh hoạt và thời gian tối thiểu. [CĐ1 F.29; CĐ5 A.1]
- Số liệu bắt buộc đúng:

| | Nhà trẻ | Mẫu giáo |
|---|---|---|
| Hoạt động học | 1–2 lần/ngày, 5–15 phút, dạng chơi – tập | 1–2 hoạt động có chủ đích/ngày, tối thiểu 25–30 phút |
| Ngủ trưa | 18–36 th: 1 giấc 110–120 phút (trẻ nhỏ hơn: xem bảng file 01) | 1 giấc 110–120 phút |
| Bữa tại trường | 24–36 th: 1 chính + 2 phụ (60–70% năng lượng, 579–676 Kcal) | 1 chính + 1 phụ (50–55%, 638–701 Kcal) |
| Nước uống/ngày | 24–36 th: 800–1.000 ml | 1.000–1.200 ml |
| Lao động | – | 10–30 phút/lần, ≥ 1–2 lần/tuần |

- Sau ngủ: vận động nhẹ – vệ sinh – uống nước trước bữa phụ chiều. Thông thoáng phòng trước đón trẻ; vệ sinh đồ dùng theo lịch. [CĐ5 A.6, E.31]
- **An toàn**: đón – trả trực tiếp, chỉ trả cho người được uỷ quyền; giờ ngủ cô luôn có mặt, kiểm tra miệng trẻ; hoạt động ngoài trời có phân công quan sát; không ghi "cô tự cho trẻ uống thuốc". [CĐ5 C]
- Giáo viên đứng lớp **không quá 8 giờ/ngày** (TT 11/2026). [CĐ1 F.30; CĐ2]

---

## G. KẾ HOẠCH ĐÁNH GIÁ (trẻ và hoạt động)

- Đánh giá trẻ: **quá trình** (hằng ngày, quan sát tự nhiên, so với chính trẻ) + **định kì** (cuối HK1, cuối năm); nhà trẻ 24–36 tháng và MG 5 tuổi: cuối năm theo **YCCĐ cuối độ tuổi**; MG có **trẻ tự đánh giá + cha mẹ tham gia**. [CT388 E]
- **Không phân loại, xếp hạng, so sánh trẻ**; không ghi kết luận chẩn đoán ("tự kỷ", "chậm phát triển") – chỉ "có biểu hiện cần lưu ý, trao đổi CBQL, y tế, phụ huynh". [CĐ5 D.29; CĐ6 A]
- Kết quả đánh giá → **điều chỉnh** mục tiêu, nội dung, hình thức, mức hỗ trợ cho KH sau; ghi 5 câu hỏi rà soát: mục tiêu phù hợp? nội dung khó/dễ/trùng? PP – môi trường hiệu quả? trẻ tiến bộ mức nào? cần bổ sung/giảm/đổi gì? [CĐ2 8.3.23]
- Kế hoạch kiểm tra của BGH (KH đánh giá trong app): chọn đúng lớp, ngày, hoạt động có trong KH tuần; tiêu chí quan sát dựa trên **GA đúng tinh thần mới** (checklist mục G file 08).

---

## H. CHECKLIST TRƯỚC KHI XUẤT KẾ HOẠCH
☐ Mục tiêu lấy từ cấp trên, có mã YCCĐ đúng độ tuổi, viết bằng hành vi quan sát được.
☐ Đủ 5 lĩnh vực trong tuần/tháng; mọi mục tiêu có hoạt động, mọi hoạt động có mục tiêu.
☐ Chủ đề lồng tự nhiên, không gò ép; có hoạt động phát sinh/điều chỉnh.
☐ Mỗi ngày: học, chơi góc, ngoài trời, ăn – ngủ – vệ sinh có nội dung giáo dục, cuối ngày.
☐ Thời lượng, số bữa, giấc ngủ, lao động đúng số liệu chương trình.
☐ Có phối hợp phụ huynh; có nhận xét cuối ngày; có lưu ý an toàn.
☐ Đúng độ tuổi; không dạy trước lớp 1; không so sánh trẻ; không nhãn chẩn đoán.`;

// ---------- Phiếu kết quả: quá trình hình thành năng lực, phẩm chất ----------
// Chép từ rosekids/tai-lieu-ctgdmn/10-ky-nang-danh-gia-tre.md (tổng hợp QĐ 388, Chuyên đề 3, Chuyên đề 4). Sửa tài liệu thì chép lại vào đây.
const SKILL_DG = `KỸ NĂNG ĐÁNH GIÁ SỰ HÌNH THÀNH NĂNG LỰC, PHẨM CHẤT CỦA TRẺ của Trường Mầm non Hoa Hồng (tổng hợp từ Chương trình GDMN thí điểm QĐ 388, Chuyên đề 3 "Tổ chức HĐGD nhà trẻ" và Chuyên đề 4 "Tổ chức HĐGD mẫu giáo theo tiếp cận năng lực"). Dùng khi viết mục "Quá trình hình thành năng lực và phẩm chất của trẻ" trên Phiếu kết quả đánh giá trẻ gửi cha mẹ.

1. 4 PHẨM CHẤT CỐT LÕI (QĐ 388)
- Yêu thương: quan tâm, gần gũi, hiểu nhu cầu và đồng cảm với người khác; tử tế, sẵn sàng giúp đỡ, chăm sóc người xung quanh, con vật, cây cối, môi trường gần gũi.
- Tôn trọng: nhận ra giá trị của bản thân và người khác; không phân biệt đối xử, chấp nhận sự khác biệt; ứng xử lễ phép; lắng nghe người khác; chờ đến lượt; trân trọng sự giúp đỡ.
- Trung thực: biết nói thật là đúng; kể đúng điều đã xảy ra; dám nhận lỗi, chấp nhận hậu quả việc mình làm; rút kinh nghiệm từ sai lầm.
- Trách nhiệm: đáng tin cậy; giữ lời hứa; hoàn thành việc được giao (trực nhật, cất đồ chơi, thu dọn); tự hào về việc mình làm; không đổ lỗi.

2. 5 NĂNG LỰC NỀN TẢNG (QĐ 388; MD4 tr.7–11)
- Giao tiếp: tham gia, chia sẻ qua tương tác với cô và bạn; bày tỏ ý kiến, nhu cầu bằng lời nói và không lời; kể lại, trả lời câu hỏi; biểu đạt qua âm nhạc, tạo hình, trò chơi, chữ, số.
- Hợp tác: phối hợp với bạn trong trò chơi, nhóm; nhận phần việc, chia sẻ đồ dùng, thương lượng, chờ lượt; tự điều chỉnh để cả nhóm chơi vui và hoàn thành việc chung.
- Giải quyết vấn đề: tò mò, hứng thú khám phá; kiên trì thử nhiều cách; đặt câu hỏi "tại sao"; xem lại kết quả, lý do chưa được và thử lại.
- Tự lực: tự làm việc cá nhân theo nền nếp (ăn, mặc, vệ sinh, cất dọn đồ); tự chọn và tự tin hành động; nói được nhu cầu, ý kiến; điều chỉnh cảm xúc khi gặp khó.
- Thích ứng: thoải mái, vui vẻ đến lớp; hòa nhập với cô và bạn; thực hiện nội quy, nền nếp; bình tĩnh khi thay đổi hoạt động, môi trường.
Năng lực không hình thành riêng lẻ mà qua hoạt động của nhiều lĩnh vực. Gợi ý gắn lĩnh vực với năng lực (MD4 tr.10–11): TC2 → thích ứng (hỗ trợ tự lực, giải quyết vấn đề); TX4 → giao tiếp, hợp tác; TX6 → hợp tác (hỗ trợ giao tiếp, thích ứng); NN2 → giao tiếp (hỗ trợ hợp tác, tự lực); NT5 → giải quyết vấn đề (hỗ trợ tự lực, hợp tác, thích ứng); NgT3 → tự lực (hỗ trợ giao tiếp, giải quyết vấn đề). Ăn, ngủ, vệ sinh, cất dọn → tự lực, trách nhiệm. Chờ lượt, chia sẻ → tôn trọng, hợp tác. Giúp bạn, chăm cây, con vật → yêu thương. Nhận lỗi, kể đúng việc → trung thực.

3. MỨC ĐỘ PHÁT TRIỂN (thang mức mong đợi CĐ4: được hướng dẫn trực tiếp → thực hiện khi được gợi ý → tương đối chủ động → biết điều chỉnh), quy ra điểm 1–10:
- 1–3 điểm: Bắt đầu hình thành – trẻ làm được khi cô hướng dẫn, làm mẫu trực tiếp; biểu hiện còn ít, chưa ổn định.
- 4–5 điểm: Đang hình thành – trẻ làm được khi cô gợi ý, nhắc nhở; biểu hiện xuất hiện nhiều lần.
- 6–8 điểm: Hình thành khá rõ – trẻ tương đối chủ động trong tình huống quen thuộc; biểu hiện thường xuyên.
- 9–10 điểm: Hình thành vững – trẻ chủ động, tự tin, biết điều chỉnh khi tình huống thay đổi, có thể giúp bạn.
Điểm phản ánh mức hỗ trợ và sự chủ động của chính trẻ so với mong đợi của lứa tuổi.

KHOẢNG ĐIỂM THEO LỨA TUỔI (quy định của trường, bắt buộc): mọi điểm phải nằm trong khoảng của lứa tuổi; điểm thấp nhất của khoảng là trẻ mới bắt đầu có biểu hiện của lứa tuổi, điểm cao nhất là trẻ đạt rất tốt mong đợi của lứa tuổi.
- Nhà trẻ 12–24 tháng (lớp Thỏ trắng): 1–5 điểm (bắt đầu hình thành → đang hình thành).
  Biểu hiện mong đợi: Giao tiếp – nhìn, chỉ tay, bập bẹ, nói từ đơn, gọi cô, bố mẹ, đáp lại khi được gọi tên. Hợp tác – chơi cạnh bạn, bắt chước cô và bạn, đưa đồ chơi khi cô gợi ý. Giải quyết vấn đề – tò mò sờ, lắc, mở, đóng đồ vật, thử lại khi chưa được. Tự lực – cầm thìa xúc ăn, cầm cốc uống, ra hiệu khi muốn đi vệ sinh, đi vững. Thích ứng – quen cô, bớt khóc khi bố mẹ về, theo nếp ăn ngủ ở lớp. Yêu thương – âu yếm, ôm, bế búp bê, vẫy chào. Tôn trọng – khoanh tay, gật đầu ạ khi cô nhắc, chờ cô đưa đồ. Trung thực – chỉ đúng đồ của mình, thể hiện đúng cảm xúc. Trách nhiệm – cùng cô cất đồ chơi, để dép đúng chỗ khi được nhắc.
- Nhà trẻ 24–36 tháng (lớp Sóc nâu, Gấu trúc): 4–8 điểm (đang hình thành → hình thành khá rõ).
  Biểu hiện mong đợi: nói câu ngắn, trả lời câu hỏi đơn giản, kể việc vừa làm; chơi cùng bạn theo nhóm nhỏ, biết chờ lượt khi cô nhắc; thử nhiều cách để lấy, lắp, xếp đồ vật; tự xúc ăn, tự đi vệ sinh có hỗ trợ, tự cất dép, cất ba lô; vui vẻ đến lớp, theo nền nếp lớp; quan tâm bạn khóc, chia đồ chơi; chào hỏi, cảm ơn, xin lỗi; nói đúng việc mình làm; cất đồ chơi đúng chỗ.
- Mẫu giáo bé 3–4 tuổi (lớp Mầm): 6–8 điểm (hình thành khá rõ).
- Mẫu giáo nhỡ 4–5 tuổi (lớp Chồi): 6–10 điểm (hình thành khá rõ → hình thành vững).
- Mẫu giáo lớn 5–6 tuổi (lớp Lá): 6–10 điểm (hình thành khá rõ → hình thành vững).

4. NGUYÊN TẮC ĐÁNH GIÁ (MD3 tr.74–80; MD4 tr.118–123)
- Đánh giá dựa trên minh chứng: biểu hiện cụ thể trong ghi chép hằng ngày, kết quả mục tiêu, hoạt động trong giáo án, sản phẩm, ảnh. Không có minh chứng thì cho điểm thận trọng ở giữa khoảng điểm của lứa tuổi và nói rõ "cô tiếp tục quan sát".
- Đánh giá quá trình: so sánh trẻ với chính trẻ qua các giai đoạn, ghi nhận cả tiến bộ nhỏ; không so sánh với bạn khác, không xếp loại, không dán nhãn.
- Tiến bộ hợp lý: điểm giữa các giai đoạn liền nhau thường thay đổi 0–2 điểm; giảm điểm chỉ khi ghi chép có biểu hiện rõ (ví dụ quấy khóc, ốm nghỉ dài).
- Mục tiêu "Cần cố gắng", "Chưa đạt" và ghi chép chưa tốt là căn cứ cho điểm thấp hơn ở năng lực, phẩm chất liên quan, đồng thời là gợi ý phối hợp với gia đình.
- Toàn diện: một biểu hiện có thể là minh chứng cho nhiều năng lực, phẩm chất; mỗi năng lực, phẩm chất nêu một biểu hiện tiêu biểu nhất.
- Lời văn gửi cha mẹ: ấm áp, cụ thể, tích cực; điều chưa tốt viết là "bé đang tập", "cô và gia đình cùng giúp bé".`;
const NL = ['Giao tiếp', 'Hợp tác', 'Giải quyết vấn đề', 'Tự lực', 'Thích ứng'];
const PC = ['Yêu thương', 'Tôn trọng', 'Trung thực', 'Trách nhiệm'];
const compItem = names => ({ type: 'object', additionalProperties: false, required: ['ten', 'diem', 'bieuHien'], properties: {
  ten: { type: 'string', enum: names },
  diem: { type: 'array', description: 'Điểm nguyên trong khoảng điểm của lứa tuổi (1 đến 10) cho từng giai đoạn, đúng số giai đoạn và theo thứ tự đã cho', items: { type: 'integer' } },
  bieuHien: { type: 'string', description: 'Một câu nêu biểu hiện tiêu biểu làm minh chứng, viết cho cha mẹ đọc' },
} });
const COMP_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['nangLuc', 'phamChat', 'nhanXet'],
  properties: {
    nangLuc: { type: 'array', description: 'Đủ 5 năng lực, mỗi năng lực một phần tử, theo thứ tự đã cho', items: compItem(NL) },
    phamChat: { type: 'array', description: 'Đủ 4 phẩm chất, mỗi phẩm chất một phần tử, theo thứ tự đã cho', items: compItem(PC) },
    nhanXet: { type: 'string', description: '1 đến 2 câu tổng kết sự tiến bộ về năng lực, phẩm chất của bé trong thời gian này' },
  },
};
const COMP_SYSTEM = `Bạn là cô giáo mầm non giàu kinh nghiệm, nắm chắc Chương trình giáo dục mầm non thí điểm (QĐ 388) và các chuyên đề tập huấn về đánh giá trẻ. Từ kết quả mục tiêu, nhận xét của cô, ghi chép hằng ngày và các hoạt động trong giáo án, bạn đánh giá bé đã hình thành 5 năng lực nền tảng và 4 phẩm chất cốt lõi đến mức nào qua từng giai đoạn, cho điểm theo đúng thang và đúng khoảng điểm của lứa tuổi trong tài liệu kỹ năng kèm theo. Chỉ dựa vào dữ liệu được gửi, không bịa sự việc. Viết tiếng Việt, gọi trẻ là "bé".`;

const goalsTxt = r => (Array.isArray(r.goals) ? r.goals : []).slice(0, 80).map(g => `- ${cut(g.domain, 60)}: ${cut(g.name, 200) || cut(g.code, 20)} → ${cut(g.result, 20)}`).join('\n');
const notesTxt = r => (Array.isArray(r.notes) ? r.notes : []).slice(-60).map(n => `- ${cut(n.date, 12)}: ` + Object.entries(n || {}).filter(([k]) => k !== 'date').slice(0, 10).map(([k, v]) => `${cut(k, 30)}: ${cut(v, 200)}`).join('; ')).join('\n');
// Hoạt động trong giáo án: giống nhau cho mọi bé trong lớp nên đặt trong lời dặn hệ thống, có bộ nhớ đệm;
// AI viết phiếu cả lớp thì từ bé thứ hai trở đi chỉ trả giá đọc bộ nhớ đệm cho phần này.
function actsBlock(r) {
  const acts = (Array.isArray(r.acts) ? r.acts : []).slice(0, 80).map(a => `- ${cut(a.date, 12)} ${cut(a.kind, 40)}: ${cut(a.name, 160)}${a.nl ? ` | năng lực hướng tới: ${cut(a.nl, 200)}` : ''}${a.pc ? ` | phẩm chất hướng tới: ${cut(a.pc, 200)}` : ''}`).join('\n');
  return `Hoạt động trong giáo án của lớp ${cut(r.cls, 60)}:\n${acts || '(chưa có giáo án)'}`;
}
function compHead(r) {
  const st = (Array.isArray(r.stages) ? r.stages : []).slice(0, 8);
  const lo = Math.max(1, Math.min(10, Math.round(+r.band?.lo) || 1)), hi = Math.max(lo, Math.min(10, Math.round(+r.band?.hi) || 10));
  return `Lứa tuổi: ${cut(r.band?.label, 60) || 'chưa rõ'}. Khoảng điểm của lứa tuổi này: từ ${lo} đến ${hi}; mọi điểm phải nằm trong khoảng này và đối chiếu với biểu hiện mong đợi của lứa tuổi trong tài liệu kỹ năng.
Các giai đoạn (mảng diem có đúng ${st.length} phần tử theo thứ tự này):
${st.map((x, i) => `${i + 1}. ${cut(x.label, 60)}: ${cut(x.from, 12)} – ${cut(x.to, 12)}`).join('\n')}`;
}

function compPrompt(r) {
  const nx = r.nx || {};
  return `Đánh giá quá trình hình thành năng lực, phẩm chất của bé ${cut(r.child, 40)}, lớp ${cut(r.cls, 60)}${r.age ? ` (${cut(r.age, 60)})` : ''}, từ ngày ${cut(r.from, 12)} đến ngày ${cut(r.to, 12)}.
${compHead(r)}
I. Kết quả từng mục tiêu:
${goalsTxt(r) || '(chưa có)'}
II. Nhận xét của cô: Ăn, ngủ, vệ sinh: ${cut(nx.an, 400) || '(trống)'} | Cảm xúc, thái độ: ${cut(nx.cx, 400) || '(trống)'} | Học và chơi: ${cut(nx.hc, 400) || '(trống)'}
Ghi chép hằng ngày của cô về bé:
${notesTxt(r) || '(chưa có ghi chép)'}
(Hoạt động trong giáo án của lớp ở phần lời dặn.)`;
}

// ---------- Phiếu kết quả đánh giá trẻ (gửi phụ huynh) ----------
const CHILD_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['anNguVs', 'camXuc', 'hocChoi', 'loiNhan'],
  properties: {
    anNguVs: { type: 'string', description: 'Ăn, ngủ, vệ sinh: 1 đến 2 câu' },
    camXuc: { type: 'string', description: 'Cảm xúc, thái độ, quan hệ với cô và bạn: 1 đến 2 câu' },
    hocChoi: { type: 'string', description: 'Học và chơi: 1 đến 3 câu, nêu điều bé làm tốt và điều bé đang tập' },
    loiNhan: { type: 'string', description: 'Lời nhắn của cô gửi gia đình: 2 đến 3 câu, gợi ý 1 đến 2 việc cha mẹ cùng bé làm ở nhà cho mục tiêu bé cần cố gắng hoặc chưa đạt, kết bằng lời cảm ơn' },
  },
};

const CHILD_SYSTEM = `Bạn là cô giáo mầm non giàu kinh nghiệm, đã được tập huấn Chương trình giáo dục mầm non thí điểm (QĐ 388). Bạn viết phần nhận xét trên "Phiếu kết quả đánh giá trẻ" mà Trường Mầm non Hoa Hồng in gửi cha mẹ trẻ.

Nguyên tắc:
- Chỉ dựa vào ghi chép hằng ngày và kết quả mục tiêu được gửi kèm; không bịa chi tiết, sự việc không có trong dữ liệu. Thiếu dữ liệu ở mục nào thì viết chung, nhẹ nhàng, ngắn.
- Gọi trẻ là "bé" hoặc "bé" kèm tên gọi. Giọng ấm áp, tích cực, cụ thể; nêu điều bé làm được trước, điều bé đang tập sau.
- Không so sánh bé với bạn khác, không dán nhãn, không dùng từ chẩn đoán hay chê trách. Điều chưa tốt viết thành điều bé "đang tập", "cô và gia đình cùng giúp bé".
- Viết tiếng Việt, câu ngắn, đúng văn phong giáo viên mầm non viết cho phụ huynh. Không ghi mã mục tiêu, không dùng gạch đầu dòng.`;

function childPrompt(r) {
  const goals = goalsTxt(r), notes = notesTxt(r);
  const photos = (Array.isArray(r.photos) ? r.photos : []).slice(0, 4).map(p => cut(p, 160)).join('; ');
  return `Viết nhận xét cho bé ${cut(r.child, 40)}, lớp ${cut(r.cls, 60)}${r.age ? ` (${cut(r.age, 60)})` : ''}, từ ngày ${cut(r.from, 12)} đến ngày ${cut(r.to, 12)}.${r.topics ? `\nChủ đề trong thời gian này: ${cut(r.topics, 400)}.` : ''}
Kết quả từng mục tiêu:
${goals || '(chưa có)'}
Ghi chép hằng ngày của cô về bé:
${notes || '(chưa có ghi chép)'}${photos ? `\nẢnh minh chứng in trên phiếu: ${photos}.` : ''}${r.note ? `\nCô đã viết lời nhắn: ${cut(r.note, 600)} (giữ đúng ý này cho loiNhan).` : ''}`;
}

// ---------- Phiếu đủ mục II và mục III trong một lượt gọi (thay cho hai lượt childReport rồi childCompetency) ----------
const FULL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['nhanXet', 'danhGia'],
  properties: {
    nhanXet: { ...CHILD_SCHEMA, description: 'Mục II: nhận xét gửi cha mẹ' },
    danhGia: { ...COMP_SCHEMA, description: 'Mục III: năng lực, phẩm chất, dựa trên dữ liệu được gửi và chính nhận xét mục II vừa viết' },
  },
};
const FULL_SYSTEM = `${CHILD_SYSTEM}

Trong cùng một lượt bạn làm hai việc: (1) viết nhận xét mục II gửi cha mẹ theo nguyên tắc trên; (2) đánh giá mục III như sau.
${COMP_SYSTEM}`;

function fullPrompt(r) {
  return `${childPrompt(r)}
Mục III: đánh giá năng lực, phẩm chất của bé trong cùng thời gian.
${compHead(r)}
(Hoạt động trong giáo án của lớp ở phần lời dặn.)`;
}

// ---------- Chuyển đổi file GV soạn theo mẫu khác: AI chỉ ra dòng nào thuộc ô nào, app chép nguyên chữ của giáo viên ----------
// AI không viết lại nội dung (giữ đúng lời giáo viên, trả lời ngắn nên nhanh và rẻ); mỗi ô là các khoảng dòng dạng "12-15, 20".
const RNG = { type: 'string', description: 'Các dòng chứa nội dung ô này, dạng "12-15" hoặc "12-15, 20" (số dòng ở đầu mỗi dòng của file); không gồm dòng tiêu đề mục; để trống nếu file không có' };
const day6 = (it, d) => ({ type: 'array', description: `${d}Đúng 6 phần tử, Thứ hai đến Thứ bảy`, items: it });
const IMPORT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['week', 'kh', 'ga', 'note'],
  properties: {
    week: { type: 'integer', description: 'Số tuần của nội dung trong file, chọn trong danh sách tuần đã cho (đối chiếu số tuần, ngày tháng, tên chủ đề nhánh); 0 nếu không xác định được' },
    kh: {
      type: 'object', additionalProperties: false, required: ['co', 'mt', 'donTre', 'theDuc', 'hdh', 'ngoaiTroi', 'gocNgay', 'anNguVs', 'chieu', 'traTre'],
      properties: {
        co: { type: 'boolean', description: 'true nếu file có kế hoạch tuần (bảng các hoạt động theo từng ngày trong tuần)' },
        mt: { type: 'array', description: 'Mã mục tiêu ghi trong kế hoạch tuần của file, viết lại theo dạng mã trong danh sách mục tiêu của lớp (ví dụ TC1.2); mảng rỗng nếu file không ghi mã', items: { type: 'string' } },
        donTre: RNG, theDuc: RNG,
        hdh: day6({ type: 'object', additionalProperties: false, required: ['dom', 'r'], properties: { dom: { type: 'string', enum: [...DOM, ''], description: 'Lĩnh vực của hoạt động học ngày đó' }, r: RNG } }, 'Hoạt động học. '),
        ngoaiTroi: day6(RNG, 'Hoạt động ngoài trời. '), gocNgay: day6(RNG, 'Hoạt động vui chơi trong lớp (các góc). '),
        anNguVs: RNG, chieu: day6(RNG, 'Sinh hoạt chiều. '), traTre: RNG,
      },
    },
    ga: {
      type: 'array', description: 'Mỗi giáo án trong file một phần tử, theo thứ tự trong file; mảng rỗng nếu file không có giáo án',
      items: {
        type: 'object', additionalProperties: false, required: ['day', 'kind', 'ten', 'linhVuc', 'tichHop', 'mucTieu', 'phamChat', 'nangLuc', 'diaDiem', 'chuanBi', 'tienTrinh', 'mtFile', 'mtGoiY'],
        properties: {
          day: { type: 'integer', description: '0 = Thứ hai, 1 = Thứ ba, … 5 = Thứ bảy' },
          kind: { type: 'string', enum: ['hoc', 'nt', 'goc', 'chieu'], description: 'hoc: hoạt động học; nt: hoạt động (vui chơi) ngoài trời; goc: hoạt động góc, chơi trong lớp; chieu: hoạt động chiều' },
          ten: RNG,
          linhVuc: { type: 'string', description: 'Lĩnh vực phát triển ghi trong giáo án, chép đúng file, ví dụ "Phát triển ngôn ngữ"; trống nếu không có' },
          tichHop: RNG, mucTieu: RNG, phamChat: RNG, nangLuc: RNG, diaDiem: RNG, chuanBi: RNG,
          tienTrinh: { type: 'array', description: 'Các bước hoặc phần của tiến trình, theo thứ tự trong file', items: { type: 'object', additionalProperties: false, required: ['buoc', 'r'], properties: { buoc: { type: 'string', description: 'Tên bước, phần, chép ngắn đúng file' }, r: RNG } } },
          mtFile: { type: 'array', description: 'Mã mục tiêu giáo viên ghi trong giáo án này, viết lại theo dạng mã của lớp; mã không có trong danh sách thì chép nguyên; rỗng nếu không ghi mã', items: { type: 'string' } },
          mtGoiY: { type: 'array', description: '1 đến 3 mã trong mục tiêu của tuần đó hợp nhất với nội dung giáo án, mã hợp nhất đứng đầu', items: { type: 'object', additionalProperties: false, required: ['code', 'muc'], properties: { code: { type: 'string' }, muc: { type: 'string', enum: ['cao', 'vua', 'thap'], description: 'Độ chắc chắn' } } } },
        },
      },
    },
    note: { type: 'string', description: 'Một câu ngắn về điều giáo viên cần xem lại (phần không xếp được, ngày không rõ…); có thể để trống' },
  },
};
const IMPORT_SYSTEM = `Bạn là cô giáo mầm non giỏi tin học, giúp Trường Mầm non Hoa Hồng chuyển kế hoạch tuần và giáo án giáo viên đã soạn theo mẫu riêng của họ vào đúng các ô của mẫu trong app.

File được gửi dưới dạng các dòng có đánh số. Dòng nằm trong bảng có nhãn [Bb Hh Cc] (bảng b, hàng h, cột c); dòng ngoài bảng không có nhãn. Bạn KHÔNG viết lại nội dung, chỉ cho biết các dòng nào thuộc ô nào; app sẽ chép nguyên văn những dòng đó.

Mẫu của app:
- Kế hoạch tuần: Đón trẻ, ăn sáng (chung cả tuần); Thể dục sáng (chung); Hoạt động học (mỗi ngày một hoạt động, có lĩnh vực TC Thể chất, NN Ngôn ngữ, NT Nhận thức, TX Tình cảm – xã hội, NgT Nghệ thuật, KNS Kỹ năng sống); Hoạt động ngoài trời (mỗi ngày); Hoạt động vui chơi trong lớp, tức các góc (mỗi ngày; nếu file ghi góc chung cả tuần thì cả 6 ngày lấy cùng các dòng đó); Ăn – ngủ – vệ sinh (chung); Sinh hoạt chiều (mỗi ngày); Trả trẻ (chung).
- Giáo án ngày có 4 loại: hoc, nt, goc, chieu. Mỗi giáo án gồm tên hoạt động, lĩnh vực, tích hợp, mục tiêu, phẩm chất, năng lực, địa điểm, chuẩn bị, tiến trình (các bước).

Cách xếp:
- Đọc hàng tiêu đề của bảng để biết cột nào là ngày nào; cột đầu thường là tên hoạt động.
- Mỗi ô chỉ gồm dòng nội dung, bỏ dòng tiêu đề mục như "1. Mục tiêu", "Chuẩn bị:", "Thứ hai". Nếu tiêu đề và nội dung chung một dòng (ví dụ "Tên hoạt động: Bé vui khỏe") thì vẫn lấy dòng đó.
- Lĩnh vực hoạt động học: Thể dục, vận động → TC; Làm quen chữ cái, văn học, truyện, thơ → NN; Toán, khám phá khoa học, khám phá xã hội → NT; Âm nhạc, tạo hình → NgT; giáo dục kỹ năng, hành vi, cảm xúc → TX hoặc KNS theo nội dung.
- Mục tiêu (mucTieu) của giáo án là các câu "Trẻ …" hoặc ý kiến thức, kỹ năng, thái độ; nếu file chia Kiến thức / Kỹ năng / Thái độ thì lấy cả các ý bên dưới.
- Giáo án có Phẩm chất, Năng lực riêng thì xếp vào phamChat, nangLuc; không có thì để trống.
- Phần đánh giá, nhận xét cuối ngày, lưu ý của giáo viên sau giờ dạy: không xếp vào ô nào.
- Ngày của giáo án: theo chữ "Thứ …" hoặc ngày tháng đối chiếu với tuần.
- Mã mục tiêu: chỉ ghi mã giáo viên thật sự viết trong file (mt, mtFile). Không tự suy ra mã cho mt, mtFile. Gợi ý mã (mtGoiY) chọn trong mục tiêu của chính tuần đó: nếu kế hoạch tuần trong file ghi mã cạnh đúng hoạt động của ngày đó thì lấy mã đó (độ chắc chắn cao); nếu không thì so nội dung giáo án với tên mục tiêu.`;

function importPrompt(r) {
  const goals = (Array.isArray(r.goals) ? r.goals : []).slice(0, 300).map(g => `- ${cut(g.code, 20)}: ${cut(g.name, 200) || '(chưa có tên)'}`).join('\n');
  const weeks = (Array.isArray(r.weeks) ? r.weeks : []).slice(0, 60).map(w => `- Tuần ${cut(w.week, 5)} (${cut(w.from, 12)} – ${cut(w.to, 12)}): chủ đề ${cut(w.topic, 100)}, nhánh ${cut(w.sub, 100)}; mục tiêu tuần: ${(Array.isArray(w.goals) ? w.goals : []).slice(0, 40).map(c => cut(c, 20)).join(', ') || '(chưa có)'}`).join('\n');
  const lines = (Array.isArray(r.lines) ? r.lines : []).slice(0, 6000).map((l, i) => `${i + 1}|${l?.g ? `[${cut(l.g, 20)}] ` : ''}${cut(l?.t, 500)}`).join('\n');
  return `Lớp ${cut(r.cls, 60)} (${cut(r.block, 80)}; độ tuổi ${cut(r.age, 10)}). Tên file: ${cut(r.fileName, 120)}.${r.week ? `\nGiáo viên đang chọn tuần ${cut(r.week, 5)}; nếu file không ghi rõ tuần thì lấy tuần này.` : ''}
Các tuần của lớp:
${weeks || '(chưa có)'}
Danh sách mục tiêu của lớp:
${goals || '(chưa có)'}
Nội dung file:
${lines}`;
}

// ---------- Rà soát giáo án GV soạn: nội dung hoạt động có phù hợp với mục tiêu (mã) đã gắn không ----------
const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: {
    items: {
      type: 'array', description: 'Mỗi giáo án được gửi một phần tử, đúng id',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'muc', 'lyDo', 'goiY'],
        properties: {
          id: { type: 'string' },
          muc: { type: 'string', enum: ['phu_hop', 'mot_phan', 'chua_phu_hop'], description: 'phu_hop: nội dung và tiến trình giúp trẻ đạt các mục tiêu đã gắn; mot_phan: chỉ đáp ứng một phần hoặc một mã; chua_phu_hop: hoạt động không hướng tới mục tiêu đã gắn' },
          lyDo: { type: 'string', description: 'Một câu ngắn nêu lý do, nói rõ mã nào chưa được đáp ứng' },
          goiY: { type: 'string', description: 'Với mot_phan, chua_phu_hop: một câu gợi ý điều chỉnh (thêm hoạt động, câu hỏi, trò chơi…) hoặc mã trong mục tiêu tuần hợp hơn; phu_hop để trống' },
        },
      },
    },
  },
};
const REVIEW_SYSTEM = `Bạn là tổ trưởng chuyên môn trường mầm non, nắm chắc Chương trình giáo dục mầm non thí điểm (QĐ 388), soạn theo mục tiêu và yêu cầu cần đạt. Bạn rà soát giáo án giáo viên đã soạn: với mỗi giáo án, xem mục tiêu giáo án, nội dung và tiến trình hoạt động có thật sự giúp trẻ đạt các mục tiêu (mã) đã gắn hay không. Đánh giá công bằng, đúng độ tuổi; chỉ dựa vào nội dung được gửi. Viết tiếng Việt, ngắn gọn.`;
function reviewPrompt(r) {
  const items = (Array.isArray(r.items) ? r.items : []).slice(0, 30).map(x =>
    `### id ${cut(x.id, 20)}: ${cut(x.kind, 40)} – ${cut(x.ten, 300)}
Mục tiêu đã gắn: ${(Array.isArray(x.goals) ? x.goals : []).slice(0, 6).map(g => `${cut(g.code, 20)} (${cut(g.name, 200) || 'chưa có tên'})`).join('; ') || '(chưa gắn mã)'}
Mục tiêu giáo án: ${(Array.isArray(x.mucTieu) ? x.mucTieu : []).slice(0, 10).map(m => cut(m, 200)).join('; ')}
Tiến trình: ${cut(x.tienTrinh, 2500)}`).join('\n\n');
  return `Lớp ${cut(r.cls, 60)} (${cut(r.block, 80)}; độ tuổi ${cut(r.age, 10)}), tuần ${cut(r.week, 5)}.\n\n${items}`;
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

    let req;
    try { req = await request.json(); } catch { return json({ error: 'Dữ liệu gửi lên không đúng' }, 400); }
    const imp = req.task === 'importDoc', rvw = req.task === 'gaReview', lesson = req.task === 'dayLesson', topic = req.task === 'topicPlan', evalp = req.task === 'evalPlan', tds = req.task === 'morningPlan', child = req.task === 'childReport', comp = req.task === 'childCompetency', full = req.task === 'childFull';
    if (req.task !== 'weekPlan' && !imp && !rvw && !topic && !evalp && !tds && !child && !comp && !full && !(lesson && GA_KIND[req.kind])) return json({ error: 'Chưa hỗ trợ yêu cầu này' }, 400);
    const model = pickModel(want, req.task);
    // Chuyển đổi file chỉ xếp dòng vào ô, không cần mô hình mạnh nhất nhưng cần đọc kỹ nên giữ mức suy nghĩ vừa.
    const light = !!LIGHT[req.task] && !imp;

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
        output_config: { effort: light ? 'low' : 'medium', format: { type: 'json_schema', schema: imp ? IMPORT_SCHEMA : rvw ? REVIEW_SCHEMA : full ? FULL_SCHEMA : comp ? COMP_SCHEMA : child ? CHILD_SCHEMA : evalp ? EVAL_SCHEMA : tds ? TDS_SCHEMA : topic ? TOPIC_SCHEMA : lesson ? LESSON_SCHEMA : SCHEMA } },
        // KH đánh giá và phiếu kết quả trẻ không soạn GA, KH nên không cần gửi kỹ năng soạn.
        // Đánh giá năng lực: kỹ năng đánh giá và hoạt động giáo án của lớp (chung cho cả lớp) nằm trước, có bộ nhớ đệm; dữ liệu riêng từng bé để sau cùng.
        system: imp ? IMPORT_SYSTEM : rvw ? REVIEW_SYSTEM : comp || full ? [{ type: 'text', text: full ? FULL_SYSTEM : COMP_SYSTEM }, { type: 'text', text: SKILL_DG, cache_control: { type: 'ephemeral' } }, { type: 'text', text: actsBlock(req), cache_control: { type: 'ephemeral' } }] : child ? CHILD_SYSTEM : evalp ? EVAL_SYSTEM : tds ? TDS_SYSTEM : [
          { type: 'text', text: topic ? TOPIC_SYSTEM : lesson ? LESSON_SYSTEM : SYSTEM },
          { type: 'text', text: lesson ? SKILL_GA : SKILL_KH, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: imp ? importPrompt(req) : rvw ? reviewPrompt(req) : full ? fullPrompt(req) : comp ? compPrompt(req) : child ? childPrompt(req) : evalp ? evalPrompt(req) : tds ? tdsPrompt(req) : topic ? topicPrompt(req) : lesson ? lessonPrompt(req) : userPrompt(req) }],
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
    const [pin, pout, pcache] = MODELS[msg.model] || MODELS[model];
    const u = msg.usage || {};
    const cost = ((u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25) * pin / 1e6 + (u.cache_read_input_tokens || 0) * pcache / 1e6 + (u.output_tokens || 0) * pout / 1e6;
    return json({ plan, model: msg.model, usage: msg.usage, cost: Math.round(cost * 10000) / 10000 });
  },
};
