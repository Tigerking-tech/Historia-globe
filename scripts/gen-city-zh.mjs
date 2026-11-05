// 生成城市中文译名字段 nz，合并进 public/cities.json
// 地名译名属事实性数据，不受版权保护，可自由商用。
// 覆盖 Natural Earth 前 300 大城市（也是地球标签主要显示的城市）。
// 未命中的城市运行时 fallback 显示英文原名（诚实降级）。
import fs from "node:fs";
import path from "node:path";

// 规范化：去重音、压空格、小写，用于容错匹配（cities.json 里有 Ōsaka / "St.  Petersburg" 等）
const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// 英文名 -> 中文名（前 300 大城市 + 常见中国城市）
const ZH = {
  Tokyo: "东京", "New York": "纽约", "Mexico City": "墨西哥城", Mumbai: "孟买",
  "São Paulo": "圣保罗", Delhi: "德里", Shanghai: "上海", Kolkata: "加尔各答",
  Dhaka: "达卡", "Buenos Aires": "布宜诺斯艾利斯", "Los Angeles": "洛杉矶",
  Karachi: "卡拉奇", Cairo: "开罗", "Rio de Janeiro": "里约热内卢", "Ōsaka": "大阪",
  Beijing: "北京", Manila: "马尼拉", Moscow: "莫斯科", Istanbul: "伊斯坦布尔",
  Paris: "巴黎", Seoul: "首尔", Lagos: "拉各斯", Jakarta: "雅加达", Chicago: "芝加哥",
  Guangzhou: "广州", London: "伦敦", Lima: "利马", Tehran: "德黑兰", Kinshasa: "金沙萨",
  Bogota: "波哥大", Shenzhen: "深圳", Wuhan: "武汉", "Hong Kong": "香港",
  Tianjin: "天津", Chennai: "金奈", Taipei: "台北", Bengaluru: "班加罗尔",
  Bangkok: "曼谷", Lahore: "拉合尔", Chongqing: "重庆", Hyderabad: "海得拉巴",
  Amaravati: "阿马拉瓦蒂", Santiago: "圣地亚哥", Miami: "迈阿密",
  "Belo Horizonte": "贝洛奥里藏特", Madrid: "马德里", Philadelphia: "费城",
  Ahmedabad: "艾哈迈达巴德", "Ho Chi Minh City": "胡志明市", Toronto: "多伦多",
  Singapore: "新加坡", Luanda: "罗安达", Baghdad: "巴格达", Barcelona: "巴塞罗那",
  Haora: "豪拉", Dallas: "达拉斯", Shenyeng: "沈阳", Shenyang: "沈阳",
  Khartoum: "喀土穆", Pune: "浦那", Sydney: "悉尼", "St. Petersburg": "圣彼得堡",
  "St.  Petersburg": "圣彼得堡", Chattogram: "吉大港", Dongguan: "东莞",
  Atlanta: "亚特兰大", Boston: "波士顿", Riyadh: "利雅得", Houston: "休斯敦",
  Hanoi: "河内", "Washington, D.C.": "华盛顿", "Washington,  D.C.": "华盛顿",
  Guadalajara: "瓜达拉哈拉", Melbourne: "墨尔本", Alexandria: "亚历山大",
  Chengdu: "成都", Detroit: "底特律", Yangon: "仰光", Xian: "西安", "Xi'an": "西安",
  "Porto Alegre": "阿雷格里港", "New Taipei": "新北", Surat: "苏拉特", Hechi: "河池",
  Abidjan: "阿比让", "Brasília": "巴西利亚", Brasilia: "巴西利亚", Ankara: "安卡拉",
  Monterrey: "蒙特雷", Yokohama: "横滨", Nanjing: "南京", "Montréal": "蒙特利尔",
  Montreal: "蒙特利尔", Guiyang: "贵阳", Recife: "累西腓", Harbin: "哈尔滨",
  Fortaleza: "福塔莱萨", "Ürümqi": "乌鲁木齐", Urumqi: "乌鲁木齐", Phoenix: "菲尼克斯",
  Zhangzhou: "漳州", Salvador: "萨尔瓦多", Busan: "釜山", "San Francisco": "旧金山",
  Johannesburg: "约翰内斯堡", Berlin: "柏林", Algiers: "阿尔及尔", Rome: "罗马",
  Pyongyang: "平壤", "Medellín": "麦德林", Medellin: "麦德林", Kabul: "喀布尔",
  Athens: "雅典", Nagoya: "名古屋", "Cape Town": "开普敦", Changchun: "长春",
  Casablanca: "卡萨布兰卡", Dalian: "大连", Kanpur: "坎普尔", Kano: "卡诺",
  "Tel Aviv": "特拉维夫", "Addis Ababa": "亚的斯亚贝巴", Curitiba: "库里蒂巴",
  Seattle: "西雅图", Zibo: "淄博", Jeddah: "吉达", Irvine: "尔湾", Nairobi: "内罗毕",
  Hangzhou: "杭州", Benoni: "贝诺尼", Caracas: "加拉加斯", Milan: "米兰",
  Stuttgart: "斯图加特", Kunming: "昆明", "Dar es Salaam": "达累斯萨拉姆",
  Jaipur: "斋浦尔", "San Diego": "圣迭戈", Taiyuan: "太原", Frankfurt: "法兰克福",
  Qingdao: "青岛", Surabaya: "泗水", Lisbon: "里斯本", Jinan: "济南", Fukuoka: "福冈",
  Campinas: "坎皮纳斯", Kaohsiung: "高雄", "Quezon City": "奎松市",
  Katowice: "卡托维兹", Aleppo: "阿勒颇", Durban: "德班", Kyiv: "基辅",
  Lucknow: "勒克瑙", Giza: "吉萨", Zhengzhou: "郑州", Taichung: "台中",
  Ibadan: "伊巴丹", Faisalabad: "费萨拉巴德", Minneapolis: "明尼阿波利斯",
  Fuzhou: "福州", Changsha: "长沙", Dakar: "达喀尔", "İzmir": "伊兹密尔",
  Izmir: "伊兹密尔", Xiangtan: "湘潭", Lanzhou: "兰州", Incheon: "仁川",
  Sapporo: "札幌", Xiamen: "厦门", Guayaquil: "瓜亚基尔", "George Town": "乔治市",
  "San Juan": "圣胡安", Mashhad: "马什哈德", Damascus: "大马士革", Daegu: "大邱",
  Nagpur: "那格浦尔", Jinxi: "金溪", Shijiazhuang: "石家庄", Tunis: "突尼斯",
  Vienna: "维也纳", Jilin: "吉林", Omdurman: "恩图曼", Bandung: "万隆",
  Bekasi: "勿加泗", Mannheim: "曼海姆", Wenzhou: "温州", Nanchang: "南昌",
  Tampa: "坦帕", Vancouver: "温哥华", Denver: "丹佛", Birmingham: "伯明翰",
  Baltimore: "巴尔的摩", Cali: "卡利", Sendai: "仙台", Naples: "那不勒斯",
  Manchester: "曼彻斯特", "St. Louis": "圣路易斯", "St.  Louis": "圣路易斯",
  Puebla: "普埃布拉", Tripoli: "的黎波里", Tashkent: "塔什干", Nanchong: "南充",
  Havana: "哈瓦那", Nanning: "南宁", "Belém": "贝伦", Belem: "贝伦",
  Patna: "巴特那", "Santo Domingo": "圣多明各", Zaozhuang: "枣庄", Baku: "巴库",
  Accra: "阿克拉", Yantai: "烟台", Medan: "棉兰", "Santa Cruz": "圣克鲁斯",
  Xuzhou: "徐州", Linyi: "临沂", Maracaibo: "马拉开波", "Kuwait City": "科威特城",
  Dammam: "达曼", Haikou: "海口", Hiroshima: "广岛",
  "Fort Lauderdale": "劳德代尔堡", "Long Beach": "长滩", Baotou: "包头",
  Hefei: "合肥", Indore: "印多尔", "Goiânia": "戈亚尼亚", Goiania: "戈亚尼亚",
  Sanaa: "萨那", "Port-au-Prince": "太子港", Haiphong: "海防", Suzhou: "苏州",
  Nanyang: "南阳", Bucharest: "布加勒斯特", Ningbo: "宁波", Douala: "杜阿拉",
  Cleveland: "克利夫兰", Tangshan: "唐山", Tainan: "台南", Portland: "波特兰",
  Datong: "大同", "Asunción": "亚松森", Asuncion: "亚松森", Brisbane: "布里斯班",
  Rawalpindi: "拉瓦尔品第", Beirut: "贝鲁特", Pittsburgh: "匹兹堡",
  "Las Vegas": "拉斯维加斯", Kyoto: "京都", Minsk: "明斯克",
  Barranquilla: "巴兰基亚", Shuyang: "沭阳", Valencia: "瓦伦西亚", Hamburg: "汉堡",
  Vadodara: "瓦多达拉", Shangqiu: "商丘", Manaus: "玛瑙斯", Wuxi: "无锡",
  Palembang: "巨港", "San Bernardino": "圣贝纳迪诺", Brussels: "布鲁塞尔",
  Essen: "埃森", Bhopal: "博帕尔", Hohhot: "呼和浩特", Luoyang: "洛阳",
  Santos: "桑托斯", Warsaw: "华沙", Rabat: "拉巴特", "Vitória": "维多利亚",
  Vitoria: "维多利亚", Quito: "基多", Antananarivo: "塔那那利佛",
  Coimbatore: "哥印拜陀", Daqing: "大庆", Luan: "六安", Wanzhou: "万州",
  Budapest: "布达佩斯", "San Jose": "圣何塞", Turin: "都灵", Ludhiana: "卢迪亚纳",
  Kumasi: "库马西", Qiqihar: "齐齐哈尔", Anshan: "鞍山", Cincinnati: "辛辛那提",
  Zhongli: "中坜", Handan: "邯郸", Taian: "泰安", Isfahan: "伊斯法罕",
  "Yaoundé": "雅温得", Yaounde: "雅温得", Sacramento: "萨克拉门托",
  Shantou: "汕头", Agra: "阿格拉", Zhanjiang: "湛江", "La Paz": "拉巴斯",
  Kalyan: "卡利安", Abuja: "阿布贾", Harare: "哈拉雷", Xiantao: "仙桃",
  Weifang: "潍坊", Khulna: "库尔纳", Tijuana: "蒂华纳", Xinyang: "信阳",
  Luzhou: "泸州", Perth: "珀斯", Toluca: "托卢卡", Leeds: "利兹",
  Vishakhapatnam: "维沙卡帕特南", "Kōbe": "神户", Kobe: "神户", Multan: "木尔坦",
  Kochi: "科钦", Gujranwala: "古杰兰瓦拉", Saidu: "赛杜", Jianmen: "剑门",
  // 额外常见城市（放大后可能出现）
  Jerusalem: "耶路撒冷", "Hong Kong": "香港", Macau: "澳门", Macao: "澳门",
  Geneva: "日内瓦", Zurich: "苏黎世", Munich: "慕尼黑", Cologne: "科隆",
  Amsterdam: "阿姆斯特丹", Stockholm: "斯德哥尔摩", Oslo: "奥斯陆",
  Copenhagen: "哥本哈根", Helsinki: "赫尔辛基", Dublin: "都柏林",
  Edinburgh: "爱丁堡", Prague: "布拉格", "Porto": "波尔图",
  Venice: "威尼斯", Florence: "佛罗伦萨", Barcelona: "巴塞罗那",
  Auckland: "奥克兰", "Buenos Aires": "布宜诺斯艾利斯",
  "Kuala Lumpur": "吉隆坡", PhnomPenh: "金边", "Phnom Penh": "金边",
  Colombo: "科伦坡", Kathmandu: "加德满都", Ulaanbaatar: "乌兰巴托",
  Tbilisi: "第比利斯", Yerevan: "埃里温", "Almaty": "阿拉木图",
  "Tel Aviv": "特拉维夫", Amman: "安曼", Doha: "多哈", "Abu Dhabi": "阿布扎比",
  Dubai: "迪拜", Muscat: "马斯喀特", "Addis Ababa": "亚的斯亚贝巴",
  Nairobi: "内罗毕", Casablanca: "卡萨布兰卡",
  Ottawa: "渥太华", "Quebec City": "魁北克市", Winnipeg: "温尼伯",
  Calgary: "卡尔加里", Edmonton: "埃德蒙顿", Montreal: "蒙特利尔",
  "San Antonio": "圣安东尼奥", Austin: "奥斯汀", Nashville: "纳什维尔",
  "New Orleans": "新奥尔良", Orlando: "奥兰多", Charlotte: "夏洛特",
  "Kansas City": "堪萨斯城", "Salt Lake City": "盐湖城", Honolulu: "檀香山",
  Anchorage: "安克雷奇", Buffalo: "布法罗", Rochester: "罗切斯特",
};

// 构建规范化查找表
const lookup = new Map();
for (const [en, zh] of Object.entries(ZH)) lookup.set(norm(en), zh);

const file = path.join(process.cwd(), "public", "cities.json");
const cities = JSON.parse(fs.readFileSync(file, "utf8"));
let covered = 0;
const missTop300 = [];
for (let i = 0; i < cities.length; i++) {
  const c = cities[i];
  const zh = lookup.get(norm(c.n));
  if (zh) {
    c.nz = zh;
    covered++;
  } else if (i < 300) {
    missTop300.push(c.n);
  }
}
fs.writeFileSync(file, JSON.stringify(cities));
console.log("cities total:", cities.length, "| with nz:", covered);
console.log("top300 covered:", 300 - missTop300.length, "/ 300");
console.log("top300 missing:", missTop300.join(", ") || "(none)");
console.log("bytes:", fs.statSync(file).size);
