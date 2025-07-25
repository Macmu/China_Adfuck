/***
 * 修正后的脚本：解决GeoIP数据库解析错误问题
 */

const enable = true

const ruleOptions = {
  ads: true, // 广告过滤
}

const rules = [
  'PROCESS-NAME,SunloginClient,DIRECT',
  'PROCESS-NAME,SunloginClient.exe,DIRECT',
  'PROCESS-NAME,AnyDesk,DIRECT',
  'PROCESS-NAME,AnyDesk.exe,DIRECT',
]

const regionOptions = {
  excludeHighPercentage: true,
  regions: [
    {
      name: 'HK香港',
      regex: /港|🇭🇰|hk|hongkong|hong kong/i,
      ratioLimit: 2,
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Hong_Kong.png',
    },
    {
      name: 'TW台湾省',
      regex: /台湾|🇼🇸|tw|taiwan|tai wan/i,
      ratioLimit: 2,
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/China.png',
    },
    {
      name: 'JP日本',
      regex: /日本|🇯🇵|jp|japan/i,
      ratioLimit: 2,
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Japan.png',
    },
    {
      name: 'US美国',
      regex: /美|🇺🇸|us|united state|america/i,
      ratioLimit: 2,
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/United_States.png',
    },
  ],
}

const defaultDNS = ['tls://223.5.5.5']
const chinaDNS = ['119.29.29.29', '223.5.5.5']
const foreignDNS = ['https://120.53.53.53/dns-query', 'https://223.5.5.5/dns-query']

const dnsConfig = {
  enable: true,
  listen: ':1053',
  ipv6: true,
  'prefer-h3': true,
  'use-hosts': true,
  'use-system-hosts': true,
  'respect-rules': true,
  'enhanced-mode': 'fake-ip',
  'fake-ip-range': '198.18.0.1/16',
  'fake-ip-filter': ['*', '+.lan', '+.local', '+.market.xiaomi.com'],
  nameserver: [...foreignDNS],
  'proxy-server-nameserver': [...foreignDNS],
  'nameserver-policy': {
    'geosite:private': 'system',
    'geosite:cn,steam@cn,category-games@cn,microsoft@cn,apple@cn': chinaDNS,
  },
}

// 规则集通用配置
const ruleProviderCommon = {
  type: 'http',
  format: 'yaml',
  interval: 86400,
  behavior: 'domain'  // 补充缺失的behavior字段
}

const groupBaseOption = {
  interval: 300,
  timeout: 3000,
  url: 'http://cp.cloudflare.com/generate_204',
  lazy: true,
  'max-failed-times': 3,
  hidden: false,
}

const ruleProviders = new Map()

function main(config) {
  const proxyCount = config?.proxies?.length ?? 0
  const proxyProviderCount =
    typeof config?.['proxy-providers'] === 'object'
      ? Object.keys(config['proxy-providers']).length
      : 0
  if (proxyCount === 0 && proxyProviderCount === 0) {
    throw new Error('配置文件中未找到任何代理')
  }

  let regionProxyGroups = []
  let otherProxyGroups = config.proxies.map(b => b.name)

  config['allow-lan'] = true
  config['bind-address'] = '*'
  config['mode'] = 'rule'
  config['dns'] = dnsConfig
  config['profile'] = {
    'store-selected': true,
    'store-fake-ip': true,
  }
  config['unified-delay'] = true
  config['tcp-concurrent'] = true
  config['keep-alive-interval'] = 1800
  config['find-process-mode'] = 'strict'
  
  // 修正1：更新geodata配置，确保兼容性
  config['geodata-mode'] = false; // 禁用新版geodata模式，避免格式冲突
  config['geodata-loader'] = 'standard'; // 使用标准加载器
  config['geo-auto-update'] = true;
  config['geo-update-interval'] = 24;

  // 修正2：更换为兼容的geoip数据库地址（解决proto解析错误）
  config['geox-url'] = {
    geoip: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/geoip.dat', // 兼容旧格式的数据库
    geosite: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat',
    mmdb: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/Country.mmdb',
    asn: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/GeoLite2-ASN.mmdb',
  };

  config['sniffer'] = {
    enable: true,
    'force-dns-mapping': true,
    'parse-pure-ip': false,
    'override-destination': true,
    sniff: {
      TLS: { ports: [443, 8443] },
      HTTP: { ports: [80, '8080-8880'] },
      QUIC: { ports: [443, 8443] },
    },
    'skip-src-address': [
      '127.0.0.0/8',
      '192.168.0.0/16',
      '10.0.0.0/8',
      '172.16.0.0/12',
    ],
  }

  config['ntp'] = {
    enable: true,
    'write-to-system': false,
    server: 'cn.ntp.org.cn',
  }

  if (!enable) {
    return config
  }

  regionOptions.regions.forEach(region => {
    let proxies = config.proxies
      .filter(a => {
        const multiplier = /(?<=[xX✕✖⨉倍率])([1-9]+(\.\d+)*|0{1}\.\d+)(?=[xX✕✖⨉倍率])*/i.exec(a.name)?.[1]
        return a.name.match(region.regex) && parseFloat(multiplier || '0') <= region.ratioLimit
      })
      .map(b => b.name)

    if (proxies.length > 0) {
      regionProxyGroups.push({
        ...groupBaseOption,
        name: region.name,
        type: 'url-test',
        tolerance: 50,
        icon: region.icon,
        proxies: proxies,
      })
    }

    otherProxyGroups = otherProxyGroups.filter(x => !proxies.includes(x))
  })

  const proxyGroupsRegionNames = regionProxyGroups.map(value => value.name)
  const hasOtherNodes = otherProxyGroups.length > 0
  if (hasOtherNodes) {
    proxyGroupsRegionNames.push('其它节点')
  }

  config['proxy-groups'] = [
    {
      ...groupBaseOption,
      name: '翻墙',
      type: 'select',
      proxies: [...proxyGroupsRegionNames, '直连'],
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Proxy.png',
    }
  ]

  config.proxies = config?.proxies || []
  config.proxies.push({
    name: '直连',
    type: 'direct',
    udp: true,
  })

  if (ruleOptions.ads) {
    rules.push(
      'GEOSITE,category-ads-all,广告过滤',
      'RULE-SET,adblockmihomo,广告过滤'
    )
    ruleProviders.set('adblockmihomo', {
      ...ruleProviderCommon,
      format: 'mrs',
      url: 'https://github.com/217heidai/adblockfilters/raw/refs/heads/main/rules/adblockmihomo.mrs',
      path: './ruleset/adblockfilters/adblockmihomo.mrs',
    })
    config['proxy-groups'].push({
      ...groupBaseOption,
      name: '广告过滤',
      type: 'select',
      proxies: ['REJECT', '直连', '翻墙'],
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Advertising.png',
    })
  }

  // 修正3：调整GEOIP规则顺序，确保数据库加载后再解析
  rules.push(
    'GEOSITE,private,DIRECT',
    'GEOIP,private,DIRECT,no-resolve',
    'GEOSITE,cn,直连',
    'GEOIP,cn,直连,no-resolve', // 此规则现在会使用兼容的数据库解析
    'MATCH,翻墙'
  )

  config['proxy-groups'] = config['proxy-groups'].concat(regionProxyGroups)

  if (hasOtherNodes) {
    config['proxy-groups'].push({
      ...groupBaseOption,
      name: '其它节点',
      type: 'select',
      proxies: otherProxyGroups,
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/World_Map.png',
    })
  }

  config['rules'] = rules
  config['rule-providers'] = Object.fromEntries(ruleProviders)

  return config
}
