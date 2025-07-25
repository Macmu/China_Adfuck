/***
 * Clash Verge Rev 全局扩展脚本（精简版）
 * 精简说明：仅保留香港、台湾、日本、美国和其它地区分类，功能分组仅保留AD广告、GF翻墙
 */

/**
 * 整个脚本的总开关
 * true = 启用
 * false = 禁用
 */
const enable = true

/**
 * 分流规则配置，仅保留广告过滤
 */
const ruleOptions = {
  ads: true, // 广告过滤
}

/**
 * 前置规则
 */
const rules = [
  'PROCESS-NAME,SunloginClient,DIRECT',
  'PROCESS-NAME,SunloginClient.exe,DIRECT',
  'PROCESS-NAME,AnyDesk,DIRECT',
  'PROCESS-NAME,AnyDesk.exe,DIRECT',
]

/**
 * 地区配置，仅保留香港、台湾、日本、美国
 */
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
      name: 'TW台湾省,
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

/**
 * DNS配置
 */
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
}

// 代理组通用配置
const groupBaseOption = {
  interval: 300,
  timeout: 3000,
  url: 'http://cp.cloudflare.com/generate_204',
  lazy: true,
  'max-failed-times': 3,
  hidden: false,
}

const ruleProviders = new Map()

// 程序入口
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

  // 基础配置
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
  config['geodata-mode'] = true
  config['geodata-loader'] = 'memconservative'
  config['geo-auto-update'] = true
  config['geo-update-interval'] = 24

  // 域名嗅探配置
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

  // NTP配置
  config['ntp'] = {
    enable: true,
    'write-to-system': false,
    server: 'cn.ntp.org.cn',
  }

  // 地理位置数据库配置
  config['geox-url'] = {
    geoip: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat',
    geosite: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
    mmdb: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country-lite.mmdb',
    asn: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb',
  }

  // 总开关关闭时不处理策略组
  if (!enable) {
    return config
  }

  // 处理地区代理组
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

  // 提取地区代理组名称
  const proxyGroupsRegionNames = regionProxyGroups.map(value => value.name)

  // 添加"其它节点"分组（如果有剩余节点）
  const hasOtherNodes = otherProxyGroups.length > 0
  if (hasOtherNodes) {
    proxyGroupsRegionNames.push('其它节点')
  }

  // 核心代理组配置：先定义GF翻墙
  const coreGroups = [
    {
      ...groupBaseOption,
      name: 'GF翻墙',
      type: 'select',
      proxies: [...proxyGroupsRegionNames, '直连'],
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Proxy.png',
    }
  ]

  // 添加直连代理
  config.proxies = config?.proxies || []
  config.proxies.push({
    name: '直连',
    type: 'direct',
    udp: true,
  })

  // 广告过滤配置（AD广告）
  let adGroup = null
  if (ruleOptions.ads) {
    rules.push(
      'GEOSITE,category-ads-all,AD广告',
      'RULE-SET,adblockmihomo,AD广告'
    )
    ruleProviders.set('adblockmihomo', {
      ...ruleProviderCommon,
      behavior: 'domain',
      format: 'mrs',
      url: 'https://github.com/217heidai/adblockfilters/raw/refs/heads/main/rules/adblockmihomo.mrs',
      path: './ruleset/adblockfilters/adblockmihomo.mrs',
    })
    adGroup = {
      ...groupBaseOption,
      name: 'AD广告',
      type: 'select',
      proxies: ['REJECT', '直连', 'GF翻墙'],
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Advertising.png',
    }
  }

  // 核心规则配置
  rules.push(
    'GEOSITE,private,DIRECT',
    'GEOIP,private,DIRECT,no-resolve',
    'GEOSITE,cn,直连',
    'GEOIP,cn,直连,no-resolve',
    'MATCH,GF翻墙'
  )

  // 构建最终代理组数组：确保AD广告在倒数第二位
  config['proxy-groups'] = [...coreGroups, ...regionProxyGroups]
  
  // 添加其它节点分组（如果有）
  if (hasOtherNodes) {
    config['proxy-groups'].push({
      ...groupBaseOption,
      name: '其它节点',
      type: 'select',
      proxies: otherProxyGroups,
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/World_Map.png',
    })
  }
  
  // 插入AD广告到倒数第二位
  if (adGroup) {
    // 如果有节点则插入到倒数第二位，否则插入到最后一位
    const insertPosition = hasOtherNodes ? config['proxy-groups'].length - 1 : config['proxy-groups'].length
    config['proxy-groups'].splice(insertPosition, 0, adGroup)
  }

  // 应用规则配置
  config['rules'] = rules
  config['rule-providers'] = Object.fromEntries(ruleProviders)

  return config
}
