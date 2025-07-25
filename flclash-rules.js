/***
 * Clash 极简配置脚本
 * 仅保留：广告过滤、翻墙功能 + 地区分类
 */
const enable = true;

// 仅保留广告过滤功能
const ruleOptions = { ads: true };

// 极简前置规则
const rules = [
  'PROCESS-NAME,SunloginClient,DIRECT',
  'PROCESS-NAME,AnyDesk,DIRECT'
];

// 地区配置（仅保留4个核心地区）
const regionOptions = {
  excludeHighPercentage: true,
  regions: [
    { name: 'HK香港', regex: /港|🇭🇰|hk/i, ratioLimit: 2, icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Hong_Kong.png' },
    { name: 'TW台湾', regex: /台湾|🇼🇸|tw/i, ratioLimit: 2, icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/China.png' },
    { name: 'JP日本', regex: /日本|🇯🇵|jp/i, ratioLimit: 2, icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Japan.png' },
    { name: 'US美国', regex: /美|🇺🇸|us/i, ratioLimit: 2, icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/United_States.png' }
  ]
};

// 简化DNS配置
const dnsConfig = {
  enable: true,
  listen: ':1053',
  'enhanced-mode': 'fake-ip',
  'fake-ip-range': '198.18.0.1/16',
  nameserver: ['https://120.53.53.53/dns-query', '223.5.5.5'],
  'nameserver-policy': { 'geosite:cn': ['119.29.29.29', '223.5.5.5'] }
};

// 通用配置精简
const groupBase = {
  interval: 300,
  timeout: 3000,
  url: 'http://cp.cloudflare.com/generate_204',
  lazy: true
};

const ruleProviders = new Map();

function main(config) {
  // 验证代理存在性
  if (!config.proxies?.length && !Object.keys(config['proxy-providers'] || {}).length) {
    throw new Error('无可用代理');
  }

  let regionGroups = [];
  let otherNodes = config.proxies.map(p => p.name);

  // 基础配置
  config['mode'] = 'rule';
  config['dns'] = dnsConfig;
  config['allow-lan'] = true;
  config['geodata-mode'] = true;

  if (!enable) return config;

  // 处理地区分组
  regionOptions.regions.forEach(region => {
    const proxies = config.proxies
      .filter(p => region.regex.test(p.name) && 
        parseFloat(/(?<=[xX✕倍率])(\d+\.?\d*)/i.exec(p.name)?.[0] || 0) <= region.ratioLimit)
      .map(p => p.name);

    if (proxies.length) {
      regionGroups.push({ ...groupBase, name: region.name, type: 'url-test', icon: region.icon, proxies });
      otherNodes = otherNodes.filter(n => !proxies.includes(n));
    }
  });

  // 核心代理组
  const regionNames = regionGroups.map(g => g.name);
  const hasOther = otherNodes.length > 0;
  if (hasOther) regionNames.push('其它节点');

  config['proxy-groups'] = [{
    ...groupBase,
    name: '翻墙',
    type: 'select',
    proxies: [...regionNames, '直连'],
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Proxy.png'
  }];

  // 添加直连
  config.proxies.push({ name: '直连', type: 'direct', udp: true });

  // 广告过滤配置
  if (ruleOptions.ads) {
    rules.push('GEOSITE,category-ads-all,广告过滤', 'RULE-SET,adblockmihomo,广告过滤');
    ruleProviders.set('adblockmihomo', {
      type: 'http',
      format: 'mrs',
      interval: 86400,
      url: 'https://github.com/217heidai/adblockfilters/raw/refs/heads/main/rules/adblockmihomo.mrs',
      path: './ruleset/adblockfilters/adblockmihomo.mrs'
    });
    config['proxy-groups'].push({
      ...groupBase,
      name: '广告过滤',
      type: 'select',
      proxies: ['REJECT', '直连', '翻墙'],
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Advertising.png'
    });
  }

  // 核心规则
  rules.push(
    'GEOSITE,private,DIRECT',
    'GEOIP,private,DIRECT,no-resolve',
    'GEOSITE,cn,直连',
    'GEOIP,cn,直连,no-resolve',
    'MATCH,翻墙'
  );

  // 添加地区组和其它节点
  config['proxy-groups'].push(...regionGroups);
  if (hasOther) {
    config['proxy-groups'].push({ ...groupBase, name: '其它节点', type: 'select', proxies: otherNodes });
  }

  // 应用配置
  config['rules'] = rules;
  config['rule-providers'] = Object.fromEntries(ruleProviders);

  return config;
}
