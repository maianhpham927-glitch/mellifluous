import { Story, Chapter, Announcement, RecentUpdate } from '../types';

export const STORIES: Story[] = [
  {
    id: 'anh-dao-nam-centimet',
    title: 'Anh Đào Rơi Vừa Đúng Năm Centimet',
    originalTitle: '五厘米的樱花雨',
    author: 'Mellifluous',
    translator: 'Mellifluous',
    status: 'completed',
    genre: ['Thanh xuân vườn trường', 'Ngọt sủng', 'Chữa lành', 'Học đường'],
    summary:
      'Tốc độ cánh hoa anh đào rơi là năm centimet một giây. Vậy phải mất bao lâu để hai trái tim đến được bên nhau?',
    totalChapters: 30,
    completedChapters: 30,
    mainChaptersCount: 26,
    extraChaptersCount: 4,
    coverImage: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80',
    colorTheme: 'from-rose-100 to-pink-200 dark:from-rose-950/40 dark:to-pink-900/40',
    hasPassword: true,
    passwordHint: 'Tốc độ rơi của cánh hoa anh đào (viết tắt không dấu: 5cms)',
    passwordKey: '5cms',
    updatedAt: 'Vừa đăng',
    views: 0,
    likes: 0,
    featured: true,
  },
];

export const SAMPLE_CHAPTERS: Record<string, Chapter[]> = {
  'mua-he-nam-ay': [
    {
      id: 'mhn-c1',
      storyId: 'mua-he-nam-ay',
      chapterNumber: 1,
      partType: 'main',
      isExtra: false,
      title: 'Chương 1: Ve sầu kêu ran rát mùa hoa phượng',
      publishedAt: '2026-06-12',
      isLocked: false,
      wordCount: 2850,
      translatorNote: 'Lời Mellifluous: Chương mở đầu siêu đáng yêu, chúc mọi người có những ngày hè thật dịu dàng bên trang sách nhé 🌸',
      content: `Tiếng ve sầu mùa hạ râm ran khắp khoảng sân trường rợp bóng cây cổ thụ. 

Thời Lam ngẩng đầu nhìn tán lá phong đung đưa dưới ánh mặt trời rực rỡ, những đốm nắng vàng rơi rụng trên bậu cửa sổ phòng học lớp 11A3.

"Thời Lam, uống sữa không?"

Giọng nói quen thuộc hơi trầm ấm từ phía sau vang lên. Cô quay đầu lại, vừa vặn bắt gặp ánh mắt trong veo như suối nguồn của Cố Diễn. Cậu thiếu niên mặc chiếc áo sơ mi đồng phục trắng tinh thơm mùi nắng và xà phòng thanh mát, một tay chống cằm, tay kia đẩy hộp sữa dâu tây mát lạnh sang góc bàn cô.

"Cậu lại mua dư à?" Thời Lam khẽ chớp mắt, khóe môi bất giác cong lên một nụ cười tinh nghịch.

"Không có." Cố Diễn cúi mắt nhìn cuốn sổ ghi chép môn Toán, đầu ngón tay khẽ gõ nhẹ lên mặt bàn gỗ, "Cố ý mua cho cậu đấy. Tiết sau kiểm tra một tiết, đừng để bị tụt đường huyết rồi lại ngồi than thở."

Gió mùa hè lướt qua rèm cửa màu xanh nhạt, cuốn theo hương hoa anh đào cuối mùa thoang thoảng. Khoảnh khắc ấy, Thời Lam dường như nghe thấy tiếng trái tim mình đập lệch một nhịp, rõ ràng và trong trẻo giữa những ngày tháng thanh xuân rực rỡ nhất.`,
    },
    {
      id: 'mhn-c2',
      storyId: 'mua-he-nam-ay',
      chapterNumber: 2,
      partType: 'main',
      isExtra: false,
      title: 'Chương 2: Cơn mưa rào bất chợt sau giờ tan học',
      publishedAt: '2026-06-15',
      isLocked: false,
      wordCount: 3100,
      translatorNote: 'Lời Mellifluous: Mưa rào mùa hạ luôn mang theo chút rung động đầu đời ~',
      content: `Năm giờ chiều, bầu trời bất chợt sầm lại rồi đổ cơn mưa rào xối xả.

Thời Lam đứng co ro dưới mái hiên dãy nhà học, đưa tay đón những giọt nước mưa mát lạnh. Học sinh lần lượt đội ô ra về, chỉ còn mình cô vì vội ra khỏi nhà sáng nay mà quên mang theo ô.

"Lên xe đi."

Chiếc xe đạp màu đen phanh kít lại trước mặt cô. Cố Diễn chân dài chống xuống mặt đất ướt sũng, chiếc áo mưa màu xanh lam che kín người cậu, chỉ để lộ gương mặt góc cạnh và đôi mắt sáng ngời.

"Nhưng cậu chỉ có một chiếc áo mưa thôi mà..." Thời Lam ngập ngừng.

Cố Diễn không nói hai lời, cởi cúc áo mưa ra rồi trùm nửa vạt áo lên đầu cô, kéo cô ngồi vào yên sau: "Ngồi chắc vào, gió thổi lạnh đấy. Ôm chặt eo tớ."

Thời Lam đỏ bừng mặt, hai bàn tay rụt rè bám vào góc áo đồng phục của cậu. Xe lướt đi trong màn mưa trắng xóa, thế giới xung quanh bỗng chốc chỉ còn lại nhịp tim dồn dập của hai người và hơi ấm ấm áp truyền qua lớp vải mỏng.`,
    },
    {
      id: 'mhn-c3',
      storyId: 'mua-he-nam-ay',
      chapterNumber: 3,
      partType: 'main',
      isExtra: false,
      title: 'Chương 3: Hẹn ước dưới tán cây phong mùa hạ (Có pass)',
      publishedAt: '2026-06-20',
      isLocked: true,
      passwordHint: 'Loại cây mà Cố Diễn và Thời Lam hẹn ước dưới tán cây (viết thường không dấu, 2 từ)',
      passwordKey: 'cayphong',
      wordCount: 3600,
      translatorNote: 'Lời Mellifluous: Chương có nội dung ngọt ngào quan trọng nên tớ cài pass nhẹ nhàng nhé. Nhớ đọc gợi ý giải pass bên dưới nha!',
      content: `Đêm trước kỳ thi đại học, cả sân trường vắng lặng không một bóng người.

Dưới gốc cây phong già cạnh sân bóng rổ, Cố Diễn lấy từ trong túi áo ra một chiếc vòng tay dây đỏ đan tay tỉ mỉ, cẩn thận đeo vào cổ tay mảnh khảnh của Thời Lam.

"Chúc Thời Lam thi thật tốt, đỗ vào nguyện vọng một." Cậu cúi đầu, ánh mắt dịu dàng như chứa cả trời sao mùa hạ, "Sau đó... hãy cho tớ một cơ hội được chính thức theo đuổi cậu, được không?"

Nước mắt Thời Lam bất giác lăn dài trên má, cô gật đầu thật mạnh giữa tiếng ve râm ran và hương hoa anh đào thơm ngát...`,
    },
    {
      id: 'mhn-c4',
      storyId: 'mua-he-nam-ay',
      chapterNumber: 4,
      partType: 'main',
      isExtra: false,
      title: 'Chương 4 (Đại kết cục): Lễ cưới mùa hoa anh đào nở',
      publishedAt: '2026-06-28',
      isLocked: false,
      wordCount: 4200,
      translatorNote: 'Lời Mellifluous: Đại kết cục viên mãn cho cặp đôi thanh xuân của chúng mình!',
      content: `Mười năm sau, tại lễ đường ngoài trời ngập tràn sắc hoa anh đào và cẩm tú cầu trắng muốt.

Cố Diễn trong bộ âu phục đen lịch lãm, ánh mắt khóa chặt vào cô dâu Thời Lam đang chậm rãi bước đi trên thảm hoa. Khi trao chiếc nhẫn kim cương vào ngón áp út của cô, giọng anh run run vì xúc động:

"Mùa hè năm mười bảy tuổi, anh từng nghĩ chỉ cần được nhìn thấy nụ cười của em mỗi ngày là đủ. Hôm nay, được nắm tay em đi hết cuộc đời này, chính là đặc ân lớn nhất cuộc đời anh."

Thời Lam mỉm cười trong nước mắt hạnh phúc, kiễng chân đặt lên môi anh một nụ hôn ngọt ngào giữa tiếng vỗ tay chúc phúc của người thân và bạn bè.`,
    },
    // PHIÊN NGOẠI
    {
      id: 'mhn-pn1',
      storyId: 'mua-he-nam-ay',
      chapterNumber: 5,
      partType: 'extra',
      isExtra: true,
      extraNumber: 1,
      title: 'Phiên ngoại 1: Góc nhìn của Cố Diễn mười năm thầm mến (Hộp sữa dâu ngọt ngào)',
      publishedAt: '2026-07-05',
      isLocked: false,
      wordCount: 3800,
      translatorNote: 'Lời Mellifluous: Phiên ngoại ngọt lịm từ góc nhìn của bạn học Cố Diễn, hé lộ bí mật cậu ấy đã thích Thời Lam từ khi nào nhé 🌸',
      content: `Nhiều năm sau này, khi bạn bè hỏi Cố Diễn vì sao luôn mua sữa dâu tây mà không phải loại nào khác, anh chỉ cười không nói.

Thực ra, Cố Diễn vốn ghét đồ ngọt. 

Nhưng vào một buổi chiều oi ả năm lớp mười, khi cả lớp đang chuẩn bị diễn tập văn nghệ, anh thấy Thời Lam ngồi mệt lả ở góc hành lang vì tụt huyết áp. Khi ấy, một bạn nữ đưa cho cô hộp sữa dâu tây. Vừa uống một ngụm, đôi mắt cô gái nhỏ bỗng sáng rực lên, hai má ửng hồng như quả đào chín mọng, khóe môi nở một nụ cười rạng rỡ làm chao đảo cả ánh hoàng hôn mùa hạ.

Kể từ ngày hôm đó, trong ba lô đi học của chàng thiếu niên lạnh lùng luôn có một ngăn dành riêng cho một hộp sữa dâu tây mát lạnh.

Mỗi buổi sáng chuyền hộp sữa qua mép bàn, nhìn bờ vai nhỏ của cô khẽ run lên vì bất ngờ, đáy lòng Cố Diễn như có hàng vạn cánh hoa anh đào cùng nở rộ. Anh thầm nghĩ, nếu có thể, anh nguyện ý làm người mua sữa dâu cho cô suốt cả một đời.`,
    },
    {
      id: 'mhn-pn2',
      storyId: 'mua-he-nam-ay',
      chapterNumber: 6,
      partType: 'extra',
      isExtra: true,
      extraNumber: 2,
      title: 'Phiên ngoại 2: Cuộc sống ngọt ngào sau hôn nhân & Mùa hè tuổi hai mươi tám',
      publishedAt: '2026-07-12',
      isLocked: false,
      wordCount: 3500,
      translatorNote: 'Lời Mellifluous: Cẩu lương ngập tràn! Cuộc sống sau hôn nhân của Diễn ca và Lam muội ngọt xỉu luôn ~',
      content: `Căn hộ nhỏ nhìn ra công viên cây xanh luôn ngập tràn ánh nắng ban mai.

Thời Lam tỉnh giấc trong vòng tay ấm áp quen thuộc. Cố Diễn vẫn đang say ngủ, chiếc mũi cao thanh tú và hàng mi dài đổ bóng xuống gò má. Cô nghịch ngợm vươn ngón tay khẽ chạm vào sống mũi anh.

Bất chợt, bàn tay to lớn của Cố Diễn vươn ra, kéo cô vào lòng ôm thật chặt, giọng nói ngái ngủ khàn khàn đầy cưng chiều vang lên bên tai:

"Thời Lam ngoan, để anh ôm thêm năm phút nữa."

"Cố Diễn, anh có biết hôm nay là ngày gì không?" Cô ngước mắt lên hỏi.

Cố Diễn mở mắt, trong con ngươi màu hổ phách chỉ phản chiếu hình bóng của một mình cô. Anh cúi đầu hôn nhẹ lên trán cô rồi thì thầm:

"Kỷ niệm tròn mười một năm ngày hộp sữa dâu đầu tiên được gửi đi. Và là ngày thứ ba trăm sáu mươi lăm anh được làm chồng của em. Anh đã đặt bàn ở tiệm bánh ngọt năm xưa rồi, tối nay tan làm anh qua đón em."`,
    },
    {
      id: 'mhn-pn3',
      storyId: 'mua-he-nam-ay',
      chapterNumber: 7,
      partType: 'extra',
      isExtra: true,
      extraNumber: 3,
      title: 'Phiên ngoại 3: Một ngày làm bố mẹ bỉm sữa của Cố Diễn - Thời Lam (Có pass)',
      publishedAt: '2026-07-20',
      isLocked: true,
      passwordHint: 'Tên ở nhà của con gái nhỏ của Cố Diễn và Thời Lam (2 từ viết thường không dấu: tieu...)',
      passwordKey: 'tieudau',
      wordCount: 4100,
      translatorNote: 'Lời Mellifluous: Phiên ngoại em bé nhỏ siêu đáng yêu! Giải pass bên dưới để mở nhé các nàng 🍓',
      content: `Gia đình nhỏ đón thêm một thành viên mới: Bé Cố Tiểu Dâu tròn hai tuổi.

Buổi chiều chủ nhật, Cố Diễn ngồi trên thảm lông phòng khách, kiên nhẫn lắp ráp lâu đài lego cho con gái. Cô bé con với đôi mắt to tròn long lanh giống hệt Thời Lam, tay ôm hộp sữa dâu nhỏ lon ton chạy đến ôm lấy chân bố.

"Bố ơi, mẹ bảo bố ngày xưa theo đuổi mẹ bằng sữa dâu có đúng không ạ?"

Cố Diễn bật cười, bế bổng con gái lên vai, quay sang nhìn Thời Lam đang đứng ở cửa bếp gọt hoa quả:

"Đúng vậy, bố dùng sữa dâu bắt cóc được thiên thần đáng yêu nhất thế giới về làm vợ đấy."

Thời Lam đỏ mặt ném cho anh một quả dâu tây ngọt lịm. Tiếng cười trẻ thơ giòn tan vang vọng khắp căn phòng ngập tràn hương nắng mùa hè.`,
    },
  ],
  'buc-thu-tinh-gui-may-troi': [
    {
      id: 'btg-c1',
      storyId: 'buc-thu-tinh-gui-may-troi',
      chapterNumber: 1,
      partType: 'main',
      isExtra: false,
      title: 'Chương 1: Cuốn từ điển cũ trang 52',
      publishedAt: '2026-08-01',
      isLocked: false,
      wordCount: 2900,
      translatorNote: 'Lời Mellifluous: Một câu chuyện thầm yêu ngọt ngào, dịu dàng như mây trời tháng sáu.',
      content: `Trang số 52 của cuốn từ điển Oxford màu xanh đã ngả vàng theo năm tháng.

Tại trang giấy đó, từ ngữ được đánh dấu bằng bút dạ quang màu cam là từ "Serendipity" — sự tình cờ may mắn ngọt ngào.

Lâm Nhĩ Nguyệt nhớ rất rõ, vào một buổi chiều đầy nắng của mùa hè năm lớp mười hai, cô đã cẩn thận ép một cánh hoa anh đào khô vào giữa trang giấy đó, kèm theo một mẩu giấy note nhỏ viết bằng nét chữ nắn nót:
"Thẩm Hoài An, mây trời hôm nay thật đẹp, giống như nụ cười của cậu vậy."

Thế nhưng, cuốn từ điển ấy đã bị một bạn học nào đó mượn đi rồi thất lạc suốt bảy năm trời...`,
    },
    {
      id: 'btg-c2',
      storyId: 'buc-thu-tinh-gui-may-troi',
      chapterNumber: 2,
      partType: 'main',
      isExtra: false,
      title: 'Chương 2: Cuộc hội ngộ tại triển lãm tranh mùa hạ (Có pass)',
      publishedAt: '2026-08-05',
      isLocked: true,
      passwordHint: 'Từ tiếng Anh chỉ sự tình cờ may mắn ngọt ngào được đánh dấu trong cuốn từ điển (11 chữ cái viết thường: serendipity)',
      passwordKey: 'serendipity',
      wordCount: 3400,
      translatorNote: 'Lời Mellifluous: Chương tái ngộ đầy cảm xúc, pass nhẹ nhàng từ trang 52 cuốn từ điển nhé!',
      content: `Tại phòng tranh trưng bày tác phẩm "Mùa Hạ Vĩnh Cửu", Lâm Nhĩ Nguyệt sững sờ trước bức tranh sơn dầu vẽ một cô gái buộc tóc đuôi ngựa ngồi bên khung cửa sổ lớp học.

Góc dưới bên phải bức tranh có đề một dòng chữ nhỏ:
"Gửi Lâm Nhĩ Nguyệt — Người đã tặng tớ cả mùa hạ rực rỡ năm mười bảy tuổi."

Phía sau lưng cô, tiếng bước chân quen thuộc dừng lại, kèm theo tiếng thở dài trầm thấp đầy cưng chiều: "Cuối cùng em cũng đến xem tranh của anh rồi."`,
    },
    {
      id: 'btg-c3',
      storyId: 'buc-thu-tinh-gui-may-troi',
      chapterNumber: 3,
      partType: 'main',
      isExtra: false,
      title: 'Chương 3: Bức thư tình bảy năm không người nhận',
      publishedAt: '2026-08-10',
      isLocked: false,
      wordCount: 3800,
      translatorNote: 'Lời Mellifluous: Chương mở nút thắt tình cảm, chúc mọi người có những phút giây đọc truyện thật ngọt ngào!',
      content: `Gió đêm tháng Tám thổi qua ban công tầng mười hai, mang theo hương hoa lài dịu ngọt.

Thẩm Hoài An mở chiếc hộp gỗ sơn mài đặt trên bàn, bên trong là hàng chục bức thư gấp hình cánh hạc giấy đã phai màu.

"Mỗi một năm ở phương xa, anh đều viết cho em một lá thư." Anh đưa tay vuốt nhẹ mái tóc cô, ánh mắt đong đầy ấm áp, "Không gửi đi được, nên đành gửi vào mây trời. May mắn thay, mây trời cuối cùng cũng đưa em trở về bên anh."`,
    },
    // PHIÊN NGOẠI BỨC THƯ TÌNH
    {
      id: 'btg-pn1',
      storyId: 'buc-thu-tinh-gui-may-troi',
      chapterNumber: 4,
      partType: 'extra',
      isExtra: true,
      extraNumber: 1,
      title: 'Phiên ngoại 1: Lá thư thứ tám mươi mốt không gửi đi (Góc nhìn Thẩm Hoài An)',
      publishedAt: '2026-08-18',
      isLocked: false,
      wordCount: 3600,
      translatorNote: 'Lời Mellifluous: Góc nhìn của chàng họa sĩ Thẩm Hoài An những năm tháng du học nơi xứ người.',
      content: `London mùa đông năm ấy tuyết rơi dày đặc.

Thẩm Hoài An ngồi trong xưởng vẽ lạnh buốt, trên giá vẽ vẫn là nụ cười rạng rỡ của cô gái năm mười bảy tuổi. Anh mở cuốn từ điển cũ, chạm nhẹ ngón tay vào cánh hoa anh đào đã khô giòn ép nơi trang 52.

Thực ra, người mượn cuốn từ điển đó năm xưa chính là anh. Khi nhìn thấy mẩu giấy note nhỏ của cô, cả thế giới của chàng thiếu niên hướng nội như bừng sáng. Nhưng vì biến cố gia đình phải ra nước ngoài đột ngột, anh không kịp nói một lời tạm biệt.

"Nhĩ Nguyệt, tuyết rơi rồi. Ở thành phố của em, ve sầu đã bắt đầu gọi hè chưa? Anh nhớ em, rất nhớ em."

Lá thư thứ tám mươi mốt được viết xong, anh cẩn thận xếp lại hình cánh hạc trắng, đặt cùng cánh hoa anh đào mùa hạ.`,
    },
    {
      id: 'btg-pn2',
      storyId: 'buc-thu-tinh-gui-may-troi',
      chapterNumber: 5,
      partType: 'extra',
      isExtra: true,
      extraNumber: 2,
      title: 'Phiên ngoại 2: Bức tranh bí mật trong phòng làm việc của Thẩm tiên sinh',
      publishedAt: '2026-08-25',
      isLocked: false,
      wordCount: 3300,
      translatorNote: 'Lời Mellifluous: Sự cưng chiều tuyệt đối của Thẩm tiên sinh dành cho phu nhân!',
      content: `Lâm Nhĩ Nguyệt vô tình đẩy cửa phòng làm việc của chồng vào một chiều mưa rào.

Dưới tấm vải lụa che chắn cẩn thận là một bức tranh sơn dầu khổ lớn chưa từng được công bố tại bất kỳ buổi triển lãm nào. Bức tranh vẽ cảnh một lễ đường rực rỡ sắc màu, cô dâu mặc váy cưới đuôi cá trắng tinh khôi đang mỉm cười rạng rỡ, còn chú rể đứng bên cạnh đang nghiêng đầu trao cho cô một chiếc nhẫn cỏ bốn lá.

Dưới góc tranh có dòng chữ nắn nót:
"Dành trọn cuộc đời này để vẽ nên tương lai của anh và Lâm Nhĩ Nguyệt."

Vòng tay từ phía sau ôm lấy eo cô thật khẽ, cằm anh tựa lên vai cô: "Thích không em? Đây là món quà kỷ niệm ngày cưới anh chuẩn bị suốt nửa năm qua."`,
    },
    {
      id: 'btg-pn3',
      storyId: 'buc-thu-tinh-gui-may-troi',
      chapterNumber: 6,
      partType: 'extra',
      isExtra: true,
      extraNumber: 3,
      title: 'Phiên ngoại 3: Chuyến du lịch ngắm cực quang ở phương Bắc (Có pass)',
      publishedAt: '2026-09-02',
      isLocked: true,
      passwordHint: 'Loài hoa gắn liền với bức thư tình năm mười bảy tuổi (3 từ viết thường không dấu: hoaanhdao)',
      passwordKey: 'hoaanhdao',
      wordCount: 3900,
      translatorNote: 'Lời Mellifluous: Phiên ngoại tuần trăng mật lãng mạn ngắm cực quang! Pass là "hoaanhdao" nhé các nàng 🌸',
      content: `Bắc Cực quang xanh ngắt phủ bóng râm mát trên bầu trời đêm tuyết trắng.

Giữa màn đêm huyền diệu của vùng cực Bắc, Thẩm Hoài An khoác thêm chiếc áo choàng lông dày cộm cho Lâm Nhĩ Nguyệt, kéo cô vào lòng để sưởi ấm.

"Nhĩ Nguyệt, người ta nói ai cùng ngắm cực quang với người mình yêu sẽ bên nhau trọn đời trọn kiếp."

Lâm Nhĩ Nguyệt mỉm cười rạng rỡ, ngước mắt nhìn dải ánh sáng kỳ ảo trên bầu trời rồi nép chặt vào lòng anh: "Vậy thì mây trời đã không phụ lòng bức thư năm ấy của chúng ta rồi."`,
    },
  ],
  'chiec-o-thang-bay': [
    {
      id: 'cot-c1',
      storyId: 'chiec-o-thang-bay',
      chapterNumber: 1,
      partType: 'main',
      isExtra: false,
      title: 'Chương 1: Cơn mưa rào tháng Bảy và chiếc ô màu xanh nhạt',
      publishedAt: '2026-08-15',
      isLocked: false,
      wordCount: 2900,
      translatorNote: 'Lời Mellifluous: Mùi mưa rào mùa hạ và sự tái ngộ dịu dàng.',
      content: `Mưa rào tháng Bảy trút xuống mặt đường nhựa nóng bỏng bốc lên làn khói mỏng.

Hứa Vãn Chi tan sở muộn, đứng co ro dưới mái hiên tiệm bánh ngọt ngắm nhìn dòng xe cộ hối hả. Bỗng nhiên, một chiếc ô trong suốt viền xanh nhạt nghiêng che trên đỉnh đầu cô, chắn hết những giọt mưa rào xối xả.

"Vãn Chi, đã bốn năm không gặp."

Giọng nói trầm thấp quen thuộc khiến tim cô thắt lại một nhịp. Cô quay đầu, bắt gặp đôi mắt sâu thẳm của Trình Diệc, người đàn ông cô từng yêu tha thiết những năm tháng thanh xuân.`,
    },
    {
      id: 'cot-c2',
      storyId: 'chiec-o-thang-bay',
      chapterNumber: 2,
      partType: 'main',
      isExtra: false,
      title: 'Chương 2: Tiệm bánh ngọt hiên mưa và ly cà phê nóng',
      publishedAt: '2026-08-20',
      isLocked: false,
      wordCount: 3150,
      translatorNote: 'Lời Mellifluous: Gương vỡ lại lành nhẹ nhàng, sâu lắng.',
      content: `Chiếc bàn gỗ nhỏ cạnh cửa sổ tiệm bánh tỏa ra hương thơm dịu ngọt của bánh tiramisu và cà phê hazelnut.

Trình Diệc cẩn thận dùng khăn giấy lau khô những giọt nước mưa vương trên vạt áo của cô: "Vẫn chứng nào tật nấy, ra đường không bao giờ xem dự báo thời tiết."

Hứa Vãn Chi mím môi: "Trình tổng bận trăm công nghìn việc, sao lại tình cờ xuất hiện ở đây?"

Trình Diệc nhìn sâu vào mắt cô, giọng nói khàn khàn: "Không phải tình cờ. Bốn năm qua, mỗi lần trời mưa rào, anh đều đứng ở góc phố này đợi em."`,
    },
    {
      id: 'cot-c3',
      storyId: 'chiec-o-thang-bay',
      chapterNumber: 3,
      partType: 'main',
      isExtra: false,
      title: 'Chương 3: Bốn năm không gặp, người xưa vẫn như cũ (VIP - Có pass)',
      publishedAt: '2026-08-28',
      isLocked: true,
      wordCount: 3600,
      translatorNote: 'Lời Mellifluous: Pass mở khóa là "mellifluous" nhé!',
      content: `Đêm mưa, trong căn hộ của Trình Diệc, ánh đèn vàng ấm áp xua tan đi cái lạnh ẩm ướt ngoài kia.

Anh kéo cô vào lòng, ghì chặt như sợ cô sẽ lại biến mất một lần nữa: "Vãn Chi, đừng trốn chạy nữa có được không? Anh sai rồi, bốn năm qua không có ngày nào anh không hối hận vì đã để mất em."

Những giọt nước mắt kìm nén suốt bốn năm qua của Hứa Vãn Chi cuối cùng cũng rơi xuống ngực áo anh...`,
    },
    // PHIÊN NGOẠI CHIẾC Ô THÁNG BẢY
    {
      id: 'cot-pn1',
      storyId: 'chiec-o-thang-bay',
      chapterNumber: 4,
      partType: 'extra',
      isExtra: true,
      extraNumber: 1,
      title: 'Phiên ngoại 1: Bí mật về chiếc ô trong suốt của Trình Diệc',
      publishedAt: '2026-09-05',
      isLocked: false,
      wordCount: 3400,
      translatorNote: 'Lời Mellifluous: Phiên ngoại hé lộ lý do vì sao Trình Diệc luôn mang theo chiếc ô màu xanh nhạt ấy!',
      content: `Trợ lý của Trình Diệc luôn thắc mắc, tại sao một vị tổng tài lạnh lùng quyền lực như Trình tổng lại luôn cất một chiếc ô nhựa trong suốt có in hình chú mèo nhỏ ở cốp xe Maybach đắt tiền.

Chỉ có Trình Diệc biết, chiếc ô đó là do Hứa Vãn Chi mua tặng anh ở cửa hàng tiện lợi vào mùa hè năm hai người mới yêu nhau. Khi đó, anh bị cảm lạnh, cô vừa càu nhàu vừa che ô cho anh suốt quãng đường từ trạm xe bus về phòng trọ.

Chiếc ô ấy anh giữ gìn cẩn thận suốt tám năm, thay từng chiếc nan sắt gỉ sét, chỉ để chờ đến ngày được một lần nữa che mưa cho cô gái của mình.`,
    },
    {
      id: 'cot-pn2',
      storyId: 'chiec-o-thang-bay',
      chapterNumber: 5,
      partType: 'extra',
      isExtra: true,
      extraNumber: 2,
      title: 'Phiên ngoại 2: Cuộc sống thường nhật: Cùng nhau đi chợ dưới cơn mưa phùn',
      publishedAt: '2026-09-12',
      isLocked: false,
      wordCount: 3200,
      translatorNote: 'Lời Mellifluous: Phiên ngoại đời thường bình dị mà ngọt ngào đến tan chảy.',
      content: `Chiều thứ Bảy, mưa phùn lất phất trên những con ngõ cổ kính.

Trình Diệc mặc chiếc áo hoodie xám giản dị, một tay xách giỏ rau tươi và tôm cá, tay kia nắm chặt lấy bàn tay nhỏ bé của Hứa Vãn Chi đang đút trong túi áo khoác của anh.

"Tối nay anh nấu canh sườn hầm sen cho em nhé?" Anh nghiêng đầu hỏi.

Hứa Vãn Chi cười tít mắt: "Thêm cả món sườn xào chua ngọt nữa cơ!"

"Được, bà xã muốn ăn gì anh cũng chiều."

Gió mưa ngoài phố dù có lạnh đến đâu, chỉ cần bên cạnh có người nắm tay, mỗi một mùa mưa đều hóa thành bản tình ca ấm áp.`,
    },
  ],
  'anh-dao-nam-centimet': [
    {
      id: 'ad5-c1',
      storyId: 'anh-dao-nam-centimet',
      chapterNumber: 1,
      partType: 'main',
      isExtra: false,
      title: 'Chương 1: Tốc độ hoa anh đào rơi',
      publishedAt: '2026-05-01',
      isLocked: false,
      wordCount: 3100,
      translatorNote: 'Lời Mellifluous: "Cậu có biết năm centimet một giây là tốc độ gì không? Là tốc độ cánh hoa anh đào rơi."',
      content: `Tháng Tư, con dốc nhỏ dẫn vào trường cấp ba rợp bóng hoa anh đào màu phớt hồng.

"Tốc độ cánh hoa anh đào rơi là năm centimet một giây." 

Hạ An quay đầu lại, tà váy đồng phục khẽ bay theo làn gió ấm. Cô nhìn cậu bạn cùng bàn Kỷ Niên đang xách cặp đi phía sau, khóe môi khẽ nhếch: "Vậy thì phải mất bao lâu, hai trái tim mới có thể đến được gần nhau?"

Kỷ Niên dừng bước, ngẩng đầu nhìn những cánh hoa bay lượn trên nền trời xanh biếc: "Không cần tính bằng giây, chỉ cần cậu quay đầu lại, tớ đã luôn ở đây rồi."`,
    },
    {
      id: 'ad5-c2',
      storyId: 'anh-dao-nam-centimet',
      chapterNumber: 2,
      partType: 'main',
      isExtra: false,
      title: 'Chương 2: Hộp cơm trưa dưới tán anh đào',
      publishedAt: '2026-05-10',
      isLocked: false,
      wordCount: 3300,
      translatorNote: 'Lời Mellifluous: Ngọt ngào và trong trẻo như hương vị của quả dâu tây đầu mùa.',
      content: `Giờ nghỉ trưa, sân sau trường học yên tĩnh lạ thường.

Hạ An mở hộp cơm bento nhỏ xinh, bên trong là những viên cơm nắm hình chú mèo con ngộ nghĩnh. Kỷ Niên ngồi cạnh cô trên băng ghế đá, lẳng lặng đưa cho cô một chai trà đào lạnh.

"Cậu lại thức khuya làm bài tập hả?" Kỷ Niên khẽ hỏi, ngón tay nhẹ nhàng gạt đi một cánh hoa anh đào vương trên vai áo cô.

"Ừm, môn Lý khó quá." Hạ An bĩu môi.

"Ăn cơm xong đi, tớ giảng lại từng dạng bài cho cậu." Giọng Kỷ Niên trầm thấp, kiên nhẫn và ấm áp vô cùng.`,
    },
    {
      id: 'ad5-c3',
      storyId: 'anh-dao-nam-centimet',
      chapterNumber: 3,
      partType: 'main',
      isExtra: false,
      title: 'Chương 3: Lời tỏ tình trong đêm pháo hoa (VIP - Có pass)',
      publishedAt: '2026-05-25',
      isLocked: true,
      wordCount: 4100,
      translatorNote: 'Lời Mellifluous: Mật khẩu là "5cms" (hoặc xem chi tiết trong mục Password nhé).',
      content: `Đêm hội pháo hoa mùa hè, cả bờ sông chật kín người reo hò.

Từng chùm pháo hoa rực rỡ bừng sáng trên bầu trời đen tuyền, soi tỏ đôi má ửng hồng của Hạ An. Giữa biển người đông đúc, Kỷ Niên bất chợt nắm chặt lấy bàn tay nhỏ bé của cô, mười ngón tay đan chặt vào nhau.

"Hạ An, năm centimet một giây là tốc độ hoa rơi. Nhưng tốc độ tớ thích cậu... là nhanh đến mức ngay từ cái nhìn đầu tiên đã không thể kìm nén được rồi."`,
    },
    {
      id: 'ad5-c4',
      storyId: 'anh-dao-nam-centimet',
      chapterNumber: 4,
      partType: 'main',
      isExtra: false,
      title: 'Chương 4 (Đại kết cục): Tốt nghiệp trung học và lời hẹn ước năm centimet',
      publishedAt: '2026-06-05',
      isLocked: false,
      wordCount: 3900,
      translatorNote: 'Lời Mellifluous: Đại kết cục chính truyện khép lại chuỗi ngày học đường tươi đẹp!',
      content: `Tiếng chuông tan học cuối cùng của đời học sinh ngân vang khắp các hành lang lớp học.

Hạ An ôm bó hoa hướng dương rực rỡ, nhìn Kỷ Niên đang bước đến với tấm bằng tốt nghiệp loại ưu trên tay. Cậu đưa tay chỉnh lại mũ cử nhân cho cô, mỉm cười dịu dàng:

"Hạ An, chúng ta cùng nhau đỗ vào trường đại học mơ ước rồi."

Dưới bầu trời mùa hạ bao la rộng lớn, hai bàn tay lại một lần nữa đan chặt vào nhau, vững vàng bước tiếp chặng đường thanh xuân rực rỡ phía trước.`,
    },
    // PHIÊN NGOẠI ANH ĐÀO
    {
      id: 'ad5-pn1',
      storyId: 'anh-dao-nam-centimet',
      chapterNumber: 5,
      partType: 'extra',
      isExtra: true,
      extraNumber: 1,
      title: 'Phiên ngoại 1: Kỷ Niên và những cánh hoa anh đào nở muộn (Góc nhìn nam chính)',
      publishedAt: '2026-06-15',
      isLocked: false,
      wordCount: 3700,
      translatorNote: 'Lời Mellifluous: Phiên ngoại ngọt ngào mở đầu cho chuỗi ngoại truyện của Kỷ Niên và Hạ An 🌸',
      content: `Trong nhật ký của Kỷ Niên năm mười sáu tuổi chỉ có đúng một dòng viết vào ngày khai giảng:
"Hôm nay, cô bạn ngồi cùng bàn tên Hạ An, cười lên có hai lúm đồng tiền rất sâu, thích ăn kẹo vị dâu tây."

Cậu thiếu niên ít nói, luôn bị coi là xa cách ấy, thực chất mỗi ngày đều dậy sớm hơn nửa tiếng, chỉ để đạp xe đi ngang qua con dốc nhỏ đợi cô cùng tới trường.

Cánh hoa anh đào rơi với tốc độ năm centimet một giây, còn tình yêu của cậu dành cho cô thì chậm rãi, bền bỉ và dịu êm như dòng suối nhỏ chảy qua năm tháng.`,
    },
    {
      id: 'ad5-pn2',
      storyId: 'anh-dao-nam-centimet',
      chapterNumber: 6,
      partType: 'extra',
      isExtra: true,
      extraNumber: 2,
      title: 'Phiên ngoại 2: Lễ thành hôn ngập tràn sắc hoa và chiếc nhẫn cánh đào (VIP - Có pass)',
      publishedAt: '2026-06-25',
      isLocked: true,
      wordCount: 4300,
      translatorNote: 'Lời Mellifluous: Phiên ngoại đám cưới trong mơ! Mật khẩu là "5cms" nha các nàng!',
      content: `Lễ cưới diễn ra đúng vào mùa hoa anh đào nở rộ nhất của năm.

Khi MC hỏi chú rể Kỷ Niên có lời nào muốn nói với cô dâu không, Kỷ Niên nhận micro, nhìn sâu vào đôi mắt long lanh của Hạ An:

"Năm mười bảy tuổi em hỏi anh, phải mất bao lâu hai trái tim mới đến được gần nhau. Hôm nay anh muốn nói với em, khoảng cách giữa anh và em từ trước đến nay chưa từng là năm centimet hay ngàn dặm xa xôi. Bởi vì từ khoảnh khắc đầu tiên nhìn thấy em, trái tim anh đã vĩnh viễn trao trọn cho em rồi."

Cả khán phòng vỡ òa trong tiếng reo hò và những tràng pháo tay rộn rã. Chiếc nhẫn cưới đính viên kim cương hình cánh hoa anh đào lấp lánh trên ngón tay nhỏ bé của Hạ An.`,
    },
    {
      id: 'ad5-pn3',
      storyId: 'anh-dao-nam-centimet',
      chapterNumber: 7,
      partType: 'extra',
      isExtra: true,
      extraNumber: 3,
      title: 'Phiên ngoại 3: Nhật ký tình yêu ngọt ngào thời đại học',
      publishedAt: '2026-07-02',
      isLocked: false,
      wordCount: 3600,
      translatorNote: 'Lời Mellifluous: Những mẩu chuyện thường nhật đáng yêu thời sinh viên của đôi bạn trẻ!',
      content: `Ký túc xá đại học, cứ mỗi chiều thứ Sáu, các bạn cùng phòng của Hạ An lại ghen tị nhìn ra ban công:
Chàng thủ khoa khoa Công nghệ thông tin Kỷ Niên luôn đứng đợi dưới gốc cây phong, trên tay xách theo một cốc trà sữa nướng ba phần đường mà Hạ An thích nhất.

"Kỷ Niên, anh không đi nghiên cứu phòng lab à?" Hạ An chạy xuống, cười khúc khích.

Kỷ Niên nhận lấy balo của cô, vòng tay xoa nhẹ đỉnh đầu cô: "Nghiên cứu quan trọng, nhưng đón bạn gái về nhà vào cuối tuần còn quan trọng hơn gấp vạn lần."`,
    },
  ],
  'duoi-tan-cay-mua-ha': [
    {
      id: 'dtc-c1',
      storyId: 'duoi-tan-cay-mua-ha',
      chapterNumber: 1,
      partType: 'main',
      isExtra: false,
      title: 'Chương 1: Ngày đầu tiên nhận lớp gia sư',
      publishedAt: '2026-07-10',
      isLocked: false,
      wordCount: 2900,
      translatorNote: 'Lời Mellifluous: Oan gia ngõ hẹp nhưng siêu hài hước và ngọt ngào!',
      content: `Ninh Duyệt đứng trước căn biệt thự có giàn hoa giấy màu hồng rực rỡ, hít một hơi thật sâu rồi bấm chuông.

"Cạch." Cánh cửa mở ra.

Không phải vị phụ huynh hiền từ như cô tưởng tượng, mà là một thanh niên cao lớn mặc đồ ngủ ở nhà, mái tóc hơi rối và ánh mắt sắc lạnh quen thuộc.

"Hội... Hội trưởng Giang?" Ninh Duyệt suýt nữa làm rơi tập tài liệu trên tay.

Giang Thần nhướng mày, khóe môi khẽ nhếch một nụ cười đầy ẩn ý: "Ồ, là cô sinh viên tuần trước dám giẫm lên giày của tôi trong hội trường đây mà? Đến làm gia sư cho em trai tôi sao?"`,
    },
    {
      id: 'dtc-c2',
      storyId: 'duoi-tan-cay-mua-ha',
      chapterNumber: 2,
      partType: 'main',
      isExtra: false,
      title: 'Chương 2: Bài toán hình học lúc mười giờ đêm',
      publishedAt: '2026-07-18',
      isLocked: false,
      wordCount: 3150,
      translatorNote: 'Lời Mellifluous: Gia sư dạy em hay anh trai dạy gia sư đây ta?',
      content: `Mười giờ đêm, cậu nhóc học sinh đã ngủ gật trên bàn.

Giang Thần bưng vào hai cốc sữa nóng, kéo ghế ngồi đối diện Ninh Duyệt: "Đoạn chứng minh này cô viết dài dòng quá rồi."

Ninh Duyệt ngẩng đầu trừng mắt: "Tôi làm đúng đáp số là được rồi mà!"

Giang Thần khẽ cười, nghiêng người ghé sát lại, tay cầm chiếc bút chì gõ nhẹ lên trang vở của cô, khoảng cách gần đến mức Ninh Duyệt có thể ngửi thấy mùi hương bạc hà thanh mát trên người anh.`,
    },
    {
      id: 'dtc-c3',
      storyId: 'duoi-tan-cay-mua-ha',
      chapterNumber: 3,
      partType: 'main',
      isExtra: false,
      title: 'Chương 3: Hội trưởng Giang bất ngờ xuất hiện ở thư viện',
      publishedAt: '2026-07-25',
      isLocked: false,
      wordCount: 3300,
      translatorNote: 'Lời Mellifluous: Càng né tránh lại càng chạm mặt ~',
      content: `Thư viện trường đại học buổi chiều vắng lặng.

Ninh Duyệt đang loay hoay kiễng chân lấy cuốn giáo trình Giải tích ở kệ sách trên cao thì một bàn tay thon dài với những khớp xương rõ ràng từ phía sau vươn tới, nhẹ nhàng rút cuốn sách xuống đưa cho cô.

"Nấm lùn thì nên biết nhờ người khác chứ."

Giang Thần tựa lưng vào giá sách, ánh mắt tràn ngập ý cười trêu chọc nhìn đôi má đang dần đỏ ửng của cô sinh viên năm nhất.`,
    },
    // PHIÊN NGOẠI GẶP LẠI CẬU DƯỚI TÁN CÂY MÙA HẠ
    {
      id: 'dtc-pn1',
      storyId: 'duoi-tan-cay-mua-ha',
      chapterNumber: 4,
      partType: 'extra',
      isExtra: true,
      extraNumber: 1,
      title: 'Phiên ngoại 1: Nhật ký ghen tuông của Hội trưởng Giang Thần',
      publishedAt: '2026-08-05',
      isLocked: false,
      wordCount: 3500,
      translatorNote: 'Lời Mellifluous: Khi hội trưởng lạnh lùng biết ghen, độ đáng yêu tăng gấp mười lần!',
      content: `Hội trưởng hội sinh viên Giang Thần nổi tiếng là người điềm tĩnh, lý trí và không màng thế sự.

Thế nhưng hôm nay, các thành viên trong ban cán sự đều cảm nhận được luồng khí lạnh tỏa ra từ vị hội trưởng này. Nguyên nhân là vì trong buổi giao lưu câu lạc bộ chiều nay, có một nam sinh khóa trên đến xin số điện thoại của cô gia sư Ninh Duyệt.

Tối hôm đó, Giang Thần trực tiếp lái xe đến cổng ký túc xá của cô. Khi Ninh Duyệt vừa bước ra, anh đã kéo cô vào góc cây râm mát, đè nén cơn ghen tuông trong giọng nói:

"Ninh Duyệt, em có nhớ hợp đồng gia sư ghi rõ điều gì không?"

"Điều gì cơ ạ?" Ninh Duyệt ngơ ngác.

"Nghiêm cấm gia sư cho số điện thoại của người khác khi chưa có sự đồng ý của phụ huynh học sinh." Giang Thần mặt không đổi sắc nói dối không chớp mắt.`,
    },
    {
      id: 'dtc-pn2',
      storyId: 'duoi-tan-cay-mua-ha',
      chapterNumber: 5,
      partType: 'extra',
      isExtra: true,
      extraNumber: 2,
      title: 'Phiên ngoại 2: Buổi hẹn hò đầu tiên dưới giàn hoa giấy rực rỡ (VIP - Có pass)',
      publishedAt: '2026-08-15',
      isLocked: true,
      wordCount: 3800,
      translatorNote: 'Lời Mellifluous: Phiên ngoại hẹn hò ngọt lịm! Mật khẩu là "chuyen" hoặc "mellifluous" nhé!',
      content: `Dưới giàn hoa giấy nở bung rực rỡ một góc phố, Ninh Duyệt mặc chiếc váy hoa nhí màu vàng nhạt đứng đợi.

Giang Thần xuất hiện với chiếc áo sơ mi trắng tinh khôi, trên tay ôm một bó hoa baby trắng tinh. Anh đưa bó hoa cho cô, rồi tự nhiên nắm lấy bàn tay nhỏ nhắn của cô đút vào túi áo khoác của mình.

"Hôm nay không có tư cách hội trưởng hay phụ huynh học sinh." Anh cúi đầu, ghé sát tai cô thì thầm, "Hôm nay, anh là bạn trai của em."`,
    },
  ],
};

// Aliases
SAMPLE_CHAPTERS['anh-dao-5cm'] = SAMPLE_CHAPTERS['anh-dao-nam-centimet'];

/**
 * Get stored custom chapters from localStorage for a specific story.
 */
export const getStoredCustomChapters = (storyId: string): Chapter[] => {
  try {
    const raw = localStorage.getItem(`mel_chapters_${storyId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const aliasId = storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;
    if (aliasId) {
      const rawAlias = localStorage.getItem(`mel_chapters_${aliasId}`);
      if (rawAlias) {
        const parsedAlias = JSON.parse(rawAlias);
        if (Array.isArray(parsedAlias) && parsedAlias.length > 0) return parsedAlias;
      }
    }
  } catch {}
  return [];
};

/**
 * Save a custom chapter into localStorage without losing existing chapters.
 */
export const saveCustomChapterToStorage = (chapter: Chapter): void => {
  try {
    const existingChapters = getStoryChapters(chapter.storyId);
    const list = existingChapters.length > 0 ? [...existingChapters] : getStoredCustomChapters(chapter.storyId);
    const targetPartType = chapter.partType || (chapter.isExtra ? 'extra' : 'main');
    const existingIndex = list.findIndex(
      (c) => c.id === chapter.id || (c.chapterNumber === chapter.chapterNumber && (c.partType || (c.isExtra ? 'extra' : 'main')) === targetPartType)
    );
    if (existingIndex >= 0) {
      list[existingIndex] = chapter;
    } else {
      list.push(chapter);
    }
    // Sort by chapterNumber ascending
    list.sort((a, b) => {
      const numA = Number(a.chapterNumber) || 0;
      const numB = Number(b.chapterNumber) || 0;
      if (numA !== numB) return numA - numB;
      const isExtraA = a.isExtra || a.partType === 'extra' ? 1 : 0;
      const isExtraB = b.isExtra || b.partType === 'extra' ? 1 : 0;
      return isExtraA - isExtraB;
    });
    localStorage.setItem(`mel_chapters_${chapter.storyId}`, JSON.stringify(list));
    setLiveStoryChapters(chapter.storyId, list);
    const aliasId = chapter.storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : chapter.storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;
    if (aliasId) {
      localStorage.setItem(`mel_chapters_${aliasId}`, JSON.stringify(list));
      setLiveStoryChapters(aliasId, list);
    }
  } catch {}
};

/**
 * Delete a custom chapter from localStorage.
 */
export const deleteCustomChapterFromStorage = (storyId: string, chapterId: string): void => {
  try {
    const list = getStoredCustomChapters(storyId);
    const filtered = list.filter((c) => c.id !== chapterId);
    localStorage.setItem(`mel_chapters_${storyId}`, JSON.stringify(filtered));
    setLiveStoryChapters(storyId, filtered);
  } catch {}
};

// Live synchronized chapters cache from Firestore across all devices and clients
const liveChaptersRuntimeCache: Record<string, Chapter[]> = {};

export const setLiveChaptersRuntimeCache = (cache: Record<string, Chapter[]>): void => {
  for (const [storyId, list] of Object.entries(cache)) {
    liveChaptersRuntimeCache[storyId] = list;
  }
};

export const setLiveStoryChapters = (storyId: string, chapters: Chapter[]): void => {
  liveChaptersRuntimeCache[storyId] = chapters;
  const aliasId = storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;
  if (aliasId) {
    liveChaptersRuntimeCache[aliasId] = chapters;
  }
};

export const getLiveChaptersRuntimeCache = (): Record<string, Chapter[]> => {
  return { ...liveChaptersRuntimeCache };
};

export const getStoryChapters = (storyId: string): Chapter[] => {
  const aliasId = storyId === 'anh-dao-nam-centimet' ? 'anh-dao-5cm' : storyId === 'anh-dao-5cm' ? 'anh-dao-nam-centimet' : null;

  // 1. Prioritize live real-time chapters from runtime synchronized cache if non-empty
  if (liveChaptersRuntimeCache[storyId] !== undefined && liveChaptersRuntimeCache[storyId].length > 0) {
    return liveChaptersRuntimeCache[storyId];
  }
  if (aliasId && liveChaptersRuntimeCache[aliasId] !== undefined && liveChaptersRuntimeCache[aliasId].length > 0) {
    return liveChaptersRuntimeCache[aliasId];
  }

  // 2. Retrieve custom author-published chapters from local storage if saved and non-empty
  try {
    const raw = localStorage.getItem(`mel_chapters_${storyId}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    if (aliasId) {
      const rawAlias = localStorage.getItem(`mel_chapters_${aliasId}`);
      if (rawAlias !== null) {
        const parsedAlias = JSON.parse(rawAlias);
        if (Array.isArray(parsedAlias) && parsedAlias.length > 0) {
          return parsedAlias;
        }
      }
    }
  } catch {}

  // 3. Retrieve base sample chapters only for predefined seed stories if not yet initialized
  if (SAMPLE_CHAPTERS[storyId] && SAMPLE_CHAPTERS[storyId].length > 0) {
    return SAMPLE_CHAPTERS[storyId];
  } else if (aliasId && SAMPLE_CHAPTERS[aliasId] && SAMPLE_CHAPTERS[aliasId].length > 0) {
    return SAMPLE_CHAPTERS[aliasId];
  }

  // 4. Return runtime cache if present (even if empty, for completely new empty stories)
  if (liveChaptersRuntimeCache[storyId] !== undefined) {
    return liveChaptersRuntimeCache[storyId];
  }

  return [];
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'tb-1',
    title: 'Bảng tin nhà Mel: Về lịch đăng chương và bảo vệ bản quyền phi lợi nhuận',
    tag: 'Thông báo',
    date: '14/09/2026',
    isPinned: true,
    content:
      'Xin chào các bạn độc giả dễ thương! Tớ là Mellifluous. Trang blog này là nơi tớ lưu giữ những bản dịch truyện ngôn tình thanh xuân mùa hè mà tớ yêu thích. Do công việc bận rộn nên tớ sẽ cập nhật chương truyện ngẫu hứng vào các buổi tối cuối tuần. Toàn bộ truyện là phi lợi nhuận, nghiêm cấm reup hoặc thương mại hóa dưới mọi hình thức nhé!',
  },
  {
    id: 'tb-2',
    title: 'Quy tắc đặt Password & Gợi ý giải mã chương VIP',
    tag: 'Lưu ý',
    date: '10/09/2026',
    isPinned: true,
    content:
      'Tất cả pass ở nhà Mel đều siêu dễ thương và liên quan trực tiếp đến chi tiết trong truyện (viết thường không dấu, không cách). Các bạn bấm vào tab "Password" trên thanh lá thư để xem chi tiết gợi ý nhé! Nếu gặp khó khăn hãy để lại bình luận ở mục Hỏi đáp, Mel sẽ hint thêm nha ~',
  },
  {
    id: 'tb-3',
    title: 'Mừng hoàn thành trọn bộ: Anh Đào Rơi Vừa Đúng Năm Centimet',
    tag: 'Lịch đăng',
    date: '02/09/2026',
    content:
      'Bộ truyện thanh xuân học đường siêu ngọt ngào đã chính thức khép lại trọn vẹn 30 chương. Cảm ơn các bạn đã đồng hành cùng Mel qua từng trang truyện trong suốt mùa hè vừa qua!',
  },
  {
    id: 'tb-4',
    title: 'Mở chuyên mục Hòm thư bạn đọc & Tâm sự mùa hè',
    tag: 'Nhắc nhở',
    date: '20/08/2026',
    content:
      'Chuyên mục "Thư gửi độc giả & Tình cảm" đã chính thức tiếp nhận những bức thư từ độc giả thân yêu. Bạn có thể gửi gắm tâm sự, cảm nghĩ về từng nhân vật hoặc chia sẻ kỷ niệm thanh xuân của chính mình!',
  },
  {
    id: 'tb-5',
    title: 'Chào đón bạn đọc ghé thăm không gian lofi Mellifluous',
    tag: 'Thông báo',
    date: '01/08/2026',
    content:
      'Chúc các bạn độc giả có những phút giây an yên, thư thái cùng những trang truyện ngọt ngào, tiếng đàn lofi du dương và những cánh hoa anh đào rơi dịu dàng.',
  },
];

export const RECENT_UPDATES: RecentUpdate[] = [
  {
    id: 'rec-1',
    storyId: 'anh-dao-nam-centimet',
    storyTitle: 'Anh Đào Rơi Vừa Đúng Năm Centimet',
    chapterNumber: 30,
    chapterTitle: 'Phiên ngoại 3: Nhật ký tình yêu ngọt ngào thời đại học',
    timeAgo: 'Vừa đăng',
    isLocked: false,
    status: 'completed',
  },
  {
    id: 'rec-2',
    storyId: 'anh-dao-nam-centimet',
    storyTitle: 'Anh Đào Rơi Vừa Đúng Năm Centimet',
    chapterNumber: 29,
    chapterTitle: 'Phiên ngoại 2: Lễ thành hôn ngập tràn sắc hoa (VIP)',
    timeAgo: '1 ngày trước',
    isLocked: true,
    status: 'completed',
  },
  {
    id: 'rec-3',
    storyId: 'anh-dao-nam-centimet',
    storyTitle: 'Anh Đào Rơi Vừa Đúng Năm Centimet',
    chapterNumber: 28,
    chapterTitle: 'Phiên ngoại 1: Kỷ Niên và những cánh hoa anh đào',
    timeAgo: '2 ngày trước',
    isLocked: false,
    status: 'completed',
  },
  {
    id: 'rec-4',
    storyId: 'anh-dao-nam-centimet',
    storyTitle: 'Anh Đào Rơi Vừa Đúng Năm Centimet',
    chapterNumber: 26,
    chapterTitle: 'Chương 26 (Đại kết cục): Lời hẹn ước năm centimet',
    timeAgo: '3 ngày trước',
    isLocked: false,
    status: 'completed',
  },
];

export const SUMMER_QUOTES = [
  {
    text: 'Tốc độ cánh hoa anh đào rơi là năm centimet một giây. Vậy phải mất bao lâu để hai trái tim đến được bên nhau?',
    book: 'Anh Đào Rơi Vừa Đúng Năm Centimet',
  },
  {
    text: 'Cậu là cơn mưa rào bất chợt của tuổi mười bảy, dù bị ướt sũng nhưng tớ vẫn muốn một lần nữa đắm chìm.',
    book: 'Thanh xuân không hối tiếc',
  },
  {
    text: 'Dưới tán cây anh đào mùa hạ, mọi bức thư chưa gửi đều đã tìm thấy người nhận của nó.',
    book: 'Anh Đào Rơi Vừa Đúng Năm Centimet',
  },
  {
    text: 'Gió mùa hè rất ngọt, nhưng không ngọt bằng khoảnh khắc cậu khẽ mỉm cười và gọi tên tớ giữa sân trường.',
    book: 'Anh Đào Rơi Vừa Đúng Năm Centimet',
  },
];

export const PLAYLIST = [
  { title: 'Gió Thổi Mùa Hạ (夏天的风)', artist: 'Ôn Lam', duration: '03:45' },
  { title: 'Mùa Hè Năm Ấy (那年夏天)', artist: 'Hứa Phi', duration: '04:12' },
  { title: 'Tớ Thích Cậu (我喜欢你)', artist: 'Cúc Tịnh Y', duration: '03:30' },
  { title: 'Cánh Hoa Anh Đào Rơi', artist: 'Lofi Chill Mel', duration: '02:58' },
];
