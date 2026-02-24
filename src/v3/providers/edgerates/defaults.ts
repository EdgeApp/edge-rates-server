import type {
  CrossChainMapping,
  EdgeAsset,
  NetworkLocationTypeMap,
  TokenOverride,
  TokenTypeMap
} from '../../types'

export const defaultCrypto: EdgeAsset[] = [
  { pluginId: 'bitcoin', tokenId: null },
  { pluginId: 'bitcoincash', tokenId: null },
  { pluginId: 'bitcoingold', tokenId: null },
  { pluginId: 'bitcoinsv', tokenId: null },
  { pluginId: 'dash', tokenId: null },
  { pluginId: 'digibyte', tokenId: null },
  { pluginId: 'dogecoin', tokenId: null },
  { pluginId: 'polkadot', tokenId: null },
  { pluginId: 'eboost', tokenId: null },
  { pluginId: 'feathercoin', tokenId: null },
  { pluginId: 'groestlcoin', tokenId: null },
  { pluginId: 'litecoin', tokenId: null },
  { pluginId: 'qtum', tokenId: null },
  { pluginId: 'ravencoin', tokenId: null },
  { pluginId: 'smartcash', tokenId: null },
  { pluginId: 'ufo', tokenId: null },
  { pluginId: 'vertcoin', tokenId: null },
  { pluginId: 'zcoin', tokenId: null },
  { pluginId: 'monero', tokenId: null },
  { pluginId: 'ripple', tokenId: null },
  { pluginId: 'tezos', tokenId: null },
  { pluginId: 'stellar', tokenId: null },
  { pluginId: 'fio', tokenId: null },
  { pluginId: 'eos', tokenId: null },
  { pluginId: 'ethereum', tokenId: 'b8c77482e45f1f44de1745f52c74426c631bdd52' },
  { pluginId: 'rsk', tokenId: null },
  { pluginId: 'ethereum', tokenId: null },
  { pluginId: 'ethereumclassic', tokenId: null },
  { pluginId: 'abstract', tokenId: null },
  { pluginId: 'botanix', tokenId: null },
  { pluginId: 'ethereum', tokenId: '1985365e9f78359a9b6ad760e32412f4a445e862' },
  { pluginId: 'ethereum', tokenId: '6b175474e89094c44da98b954eedeac495271d0f' },
  { pluginId: 'ethereum', tokenId: '89d24a6b4ccb1b6faa2625fe562bdd9a23260359' },
  { pluginId: 'ethereum', tokenId: '667088b212ce3d06a1b553a7221e1fd19000d9af' },
  { pluginId: 'ethereum', tokenId: 'dac17f958d2ee523a2206206994597c13d831ec7' },
  { pluginId: 'ethereum', tokenId: 'f8e386eda857484f5a12e4b5daa9984e06e73705' },
  { pluginId: 'ethereum', tokenId: 'cdb7ecfd3403eef3882c65b761ef9b5054890a47' },
  { pluginId: 'ethereum', tokenId: 'a117000000f279d81a1d3cc75430faa017fa5a2e' },
  { pluginId: 'ethereum', tokenId: '0d8775f648430679a709e98d2b0cb6250d2887ef' },
  { pluginId: 'ethereum', tokenId: '1f573d6fb3f13d689ff844b4ce37794d79a7ff1c' },
  { pluginId: 'ethereum', tokenId: 'defa4e8a7bcba345f687a2f1456f5edd9ce97202' },
  { pluginId: 'ethereum', tokenId: '9992ec3cf6a55b00978cddf2b27bc6882d88d1ec' },
  { pluginId: 'ethereum', tokenId: 'b64ef51c888972c908cfacf59b47c1afbc0ab8ac' },
  { pluginId: 'ethereum', tokenId: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  { pluginId: 'ethereum', tokenId: 'dc035d45d973e3ec169d2276ddab16f1e407384f' },
  { pluginId: 'ethereum', tokenId: '0000000000085d4780b73119b644ae5ecd22b376' },
  { pluginId: 'ethereum', tokenId: 'e41d2489571d322189246dafa5ebde1f4699f498' },
  { pluginId: 'ethereum', tokenId: '6810e776880c02933d47db1b9fc05908e5386b96' },
  { pluginId: 'ethereum', tokenId: 'd26114cd6ee289accf82350c8d8487fedb8a0c07' },
  { pluginId: 'ethereum', tokenId: '1776e1f26f98b1a5df9cd347953a26dd3cb46671' },
  { pluginId: 'ethereum', tokenId: '9f8f72aa9304c8b593d555f12ef6589cc3a579a2' },
  { pluginId: 'ethereum', tokenId: '056fd409e1d7a124bd7017459dfea2f387b6d5cd' },
  { pluginId: 'ethereum', tokenId: '4156d3342d5c385a87d264f90653733592000581' },
  { pluginId: 'ethereum', tokenId: '0f5d2fb29fb7d3cfee444a200298f468908cc942' },
  { pluginId: 'ethereum', tokenId: 'b62132e35a6c13ee1ee0f84dc5d40bad8d815206' },
  { pluginId: 'ethereum', tokenId: '419d0d8bdd9af5e606ae2232ed285aff190e711b' },
  { pluginId: 'ethereum', tokenId: '818fc6c2ec5986bc6e2cbf00939d90556ab12ce5' },
  { pluginId: 'ethereum', tokenId: '514910771af9ca656af840dff83e8264ecf986ca' },
  { pluginId: 'ethereum', tokenId: '420412e765bfa6d85aaac94b4f7b708c89be2e2b' },
  { pluginId: 'ethereum', tokenId: 'b1cd6e4153b2a390cf00a6556b0fc1458c4a5533' },
  { pluginId: 'ethereum', tokenId: '4575f41308ec1483f3d399aa9a2826d74da13deb' },
  { pluginId: 'ethereum', tokenId: 'c00e94cb662c3520282e6f5717214004a7f26888' },
  { pluginId: 'ethereum', tokenId: 'a3d58c4e56fedcae3a7c43a725aee9a71f0ece4e' },
  { pluginId: 'ethereum', tokenId: 'c011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f' },
  { pluginId: 'ethereum', tokenId: '57ab1ec28d129707052df4df418d58a2d46d5f51' },
  { pluginId: 'ethereum', tokenId: 'fe18be6b3bd88a2d2a7f928d00292e7a9963cfc6' },
  { pluginId: 'ethereum', tokenId: '7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9' },
  { pluginId: 'ethereum', tokenId: '2260fac5e5542a773aa44fbcfedf7c193bc2c599' },
  { pluginId: 'ethereum', tokenId: '0bc529c00c6401aef6d220be8c6ea1667f6ad93e' },
  { pluginId: 'ethereum', tokenId: 'd533a949740bb3306d119cc777fa900ba034cd52' },
  { pluginId: 'ethereum', tokenId: 'ba100000625a3754423978a60c9317c58a424e3d' },
  { pluginId: 'ethereum', tokenId: '6b3595068778dd592e39a122f4f5a5cf09c90fe2' },
  { pluginId: 'ethereum', tokenId: '04fa0d235c4abf4bcf4787af4cf447de572ef828' },
  { pluginId: 'ethereum', tokenId: '3472a5a71965499acd81997a54bba8d852c6e53d' },
  { pluginId: 'ethereum', tokenId: '875773784af8135ea0ef43b5a374aad105c5d39e' },
  { pluginId: 'ethereum', tokenId: 'd7c49cee7e9188cca6ad8ff264c1da2e69d4cf3b' },
  { pluginId: 'ethereum', tokenId: '2ba592f78db6436527729929aaf6c908497cb200' },
  { pluginId: 'ethereum', tokenId: '429881672b9ae42b8eba0e26cd9c73711b891ca5' },
  { pluginId: 'ethereum', tokenId: '38e4adb44ef08f22f5b5b76a8f0c2d0dcbe7dca1' },
  { pluginId: 'ethereum', tokenId: 'fa5047c9c78b8877af97bdcb85db743fd7313d4a' },
  { pluginId: 'ethereum', tokenId: 'ad32a8e6220741182940c5abf610bde99e737b2d' },
  { pluginId: 'ethereum', tokenId: 'ffffffff2ba8f66d4e51811c5190992176930278' },
  { pluginId: 'ethereum', tokenId: '0954906da0bf32d5479e25f46056d22f08464cab' },
  { pluginId: 'ethereum', tokenId: 'c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { pluginId: 'ethereum', tokenId: '8daebade922df735c38c80c7ebd708af50815faa' },
  { pluginId: 'ethereum', tokenId: '1494ca1f11d487c2bbe4543e90080aeba4ba3c2b' },
  { pluginId: 'ethereum', tokenId: 'b4bebd34f6daafd808f73de0d10235a92fbb6c3d' },
  { pluginId: 'ethereum', tokenId: 'ba11d00c5f74255f56a5e366f4f77f5a186d7f55' },
  { pluginId: 'ethereum', tokenId: '408e41876cccdc0f92210600ef50372656052a38' },
  { pluginId: 'ethereum', tokenId: 'd46ba6d942050d489dbd938a2c909a5d5039a161' },
  { pluginId: 'ethereum', tokenId: '967da4048cd07ab37855c090aaf366e4ce1b9f48' },
  { pluginId: 'ethereum', tokenId: '7dd9c5cba05e151c895fde1cf355c9a1d5da6429' },
  { pluginId: 'ethereum', tokenId: '1f9840a85d5af5bf1d1762f925bdaddc4201f984' },
  { pluginId: 'ethereum', tokenId: '158079ee67fce2f58472a96584a73c7ab9ac95c1' },
  { pluginId: 'ethereum', tokenId: '39aa39c021dfbae8fac545936693ac917d5e7563' },
  { pluginId: 'ethereum', tokenId: '4ddc2d193948926d02f9b1fe9e1daa0718270ed5' },
  { pluginId: 'ethereum', tokenId: '6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e' },
  { pluginId: 'ethereum', tokenId: 'b3319f5d18bc0d84dd1b4825dcde5d5f7266d407' },
  { pluginId: 'ethereum', tokenId: 'c11b1268c1a384e55c48c2391d8d480264a3a7f4' },
  { pluginId: 'ethereum', tokenId: 'f5dce57282a584d2746faf1593d3121fcac444dc' },
  { pluginId: 'ethereum', tokenId: '5d3a536e4d6dbd6114cc1ead35777bab948e3643' },
  { pluginId: 'ethereum', tokenId: '4e15361fd6b4bb609fa63c81a2be19d873717870' },
  { pluginId: 'wax', tokenId: null },
  { pluginId: 'hedera', tokenId: null },
  { pluginId: 'zcash', tokenId: null },
  { pluginId: 'avalanche', tokenId: null },
  {
    pluginId: 'avalanche',
    tokenId: '60781c2586d68229fde47564546784ab3faca982'
  },
  {
    pluginId: 'avalanche',
    tokenId: 'e896cdeaac9615145c0ca09c8cd5c25bced6384c'
  },
  {
    pluginId: 'avalanche',
    tokenId: 'd1c3f94de7e5b45fa4edbba472491a9f4b166fc4'
  },
  {
    pluginId: 'avalanche',
    tokenId: 'd6070ae98b8069de6b494332d1a1a81b6179d960'
  },
  {
    pluginId: 'avalanche',
    tokenId: '59414b3089ce2af0010e7523dea7e2b35d776ec7'
  },
  {
    pluginId: 'avalanche',
    tokenId: '6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd'
  },
  {
    pluginId: 'avalanche',
    tokenId: '214db107654ff987ad859f34125307783fc8e387'
  },
  { pluginId: 'ethereum', tokenId: '4fabb145d64652a948d72533023f6e7a623c7c53' },
  { pluginId: 'celo', tokenId: null },
  { pluginId: 'celo', tokenId: '765de816845861e75a25fca122bb6898b8b1282a' },
  { pluginId: 'celo', tokenId: 'd8763cba276a3738e6de85b4b3bf5fded6d6ca73' },
  { pluginId: 'telos', tokenId: null },
  { pluginId: 'solana', tokenId: null },
  { pluginId: 'ethereumpow', tokenId: null },
  { pluginId: 'rsk', tokenId: '2acc95758f8b5f583470ba265eb685a8f45fc9d5' },
  { pluginId: 'tron', tokenId: null },
  { pluginId: 'tron', tokenId: 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR' },
  { pluginId: 'tron', tokenId: 'TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4' },
  { pluginId: 'tron', tokenId: 'TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn' },
  { pluginId: 'tron', tokenId: 'TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9' },
  { pluginId: 'tron', tokenId: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7' },
  { pluginId: 'tron', tokenId: 'TFczxzPhnThNSqr5by8tvxsdCFRRz6cPNq' },
  { pluginId: 'tron', tokenId: 'TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S' },
  { pluginId: 'tron', tokenId: 'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT' },
  { pluginId: 'piratechain', tokenId: null },
  { pluginId: 'ethereum', tokenId: '5165d24277cd063f5ac44efd447b27025e888f37' },
  { pluginId: 'ethereum', tokenId: 'a06bc25b5805d5f8d82847d191cb4af5a3e873e0' },
  { pluginId: 'ethereum', tokenId: '028171bca77440897b824ca71d1c56cac55b68a3' },
  { pluginId: 'ethereum', tokenId: '05ec93c0365baaeabf7aeffb0972ea7ecdd39cf1' },
  { pluginId: 'ethereum', tokenId: '030ba81f1c18d280636f32af80b9aad02cf0854e' },
  { pluginId: 'ethereum', tokenId: '9ff58f4ffb29fa2266ab25e75e2a8b3503311656' },
  { pluginId: 'ethereum', tokenId: '35f6b052c598d933d69a4eec4d04c73a191fe6c2' },
  { pluginId: 'ethereum', tokenId: 'cc12abe4ff81c9378d670de1b57f8e0dd228d77a' },
  { pluginId: 'ethereum', tokenId: '3ed3b47dd13ec9a98b44e6204a523e766b225811' },
  { pluginId: 'ethereum', tokenId: 'c713e5e149d5d0715dcd1c156a020976e7e56b88' },
  { pluginId: 'ethereum', tokenId: 'a685a61171bb30d4072b338c80cb7b2c865c873e' },
  { pluginId: 'ethereum', tokenId: 'df7ff54aacacbff42dfe29dd6144a69b629f8c9e' },
  { pluginId: 'ethereum', tokenId: '39c6b3e42d6a679d7d776778fe880bc9487c2eda' },
  { pluginId: 'ethereum', tokenId: 'bcca60bb61934080951369a648fb03df4f96263c' },
  { pluginId: 'ethereum', tokenId: '6c5024cd4f8a59110119c56f8933403a539555eb' },
  { pluginId: 'ethereum', tokenId: 'b9d7cb55f463405cdfbe4e90a6d2df01c2b92bf1' },
  { pluginId: 'ethereum', tokenId: 'eb4c2781e4eba804ce9a9803c67d0893436bb27d' },
  { pluginId: 'ethereum', tokenId: '459086f2376525bdceba5bdda135e4e9d3fef5bf' },
  { pluginId: 'ethereum', tokenId: '1c5db575e2ff833e46a2e9864c22f4b22e0b37c2' },
  { pluginId: 'algorand', tokenId: null },
  { pluginId: 'ethereum', tokenId: 'ff20817765cb7f73d4bde2e66e067e58d11095c2' },
  { pluginId: 'ethereum', tokenId: '4d224452801aced8b2f0aebe155379bb5d594381' },
  { pluginId: 'ethereum', tokenId: 'a0b73e1ff0b80914ab6fe0444e65848c4c34450b' },
  { pluginId: 'ethereum', tokenId: 'f629cbd94d3791c9250152bd8dfbdf380e2a3b9c' },
  { pluginId: 'ethereum', tokenId: 'd1d2eb1b1e90b638588728b4130137d262c87cae' },
  { pluginId: 'ethereum', tokenId: 'd567b5f02b9073ad3a982a099a23bf019ff11d1c' },
  { pluginId: 'ethereum', tokenId: 'bbbbca6a901c926f240b89eacb641d8aec7aeafd' },
  { pluginId: 'ethereum', tokenId: '3a4f40631a4f906c2bad353ed06de7a5d3fcb430' },
  { pluginId: 'ethereum', tokenId: '4a220e6096b25eadb88358cb44068a3248254675' },
  { pluginId: 'ethereum', tokenId: '0763fdccf1ae541a5961815c0872a8c5bc6de4d7' },
  { pluginId: 'ethereum', tokenId: '95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce' },
  { pluginId: 'ethereum', tokenId: '446c9033e7516d820cc9a2ce2d0b7328b579406f' },
  { pluginId: 'ethereum', tokenId: '74232704659ef37c08995e386a2e26cc27a8d7b1' },
  { pluginId: 'ethereum', tokenId: 'c944e90c64b2c07662a292be6244bdf05cda44a7' },
  { pluginId: 'ethereum', tokenId: '3845badade8e6dff049820680d1f14bd3903a5d0' },
  { pluginId: 'ethereum', tokenId: '6982508145454ce325ddbe47a25d4ec3d2311933' },
  { pluginId: 'ethereum', tokenId: 'bea269038eb75bdab47a9c04d0f5c572d94b93d5' },
  { pluginId: 'pulsechain', tokenId: null },
  { pluginId: 'ethereum', tokenId: 'b50721bcf8d664c30412cfbc6cf7a15145234ad1' },
  { pluginId: 'filecoin', tokenId: null },
  { pluginId: 'ethereum', tokenId: '45804880de22913dafe09f4980848ece6ecbaf78' },
  { pluginId: 'ethereum', tokenId: '6c3ea9036406852006290770bedfcaba0e23a0e8' },
  { pluginId: 'thorchainrune', tokenId: null },
  { pluginId: 'coreum', tokenId: null },
  {
    pluginId: 'coreum',
    tokenId:
      'ibc13b2c536bb057ac79d5616b8ea1b9540ec1f2170718caff6f0083c966fffed0b'
  },
  { pluginId: 'ethereum', tokenId: '7ddc52c4de30e94be3a6a0a2b259b2850f421989' },
  {
    pluginId: 'solana',
    tokenId: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3'
  },
  {
    pluginId: 'solana',
    tokenId: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof'
  },
  {
    pluginId: 'solana',
    tokenId: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
  },
  {
    pluginId: 'coreum',
    tokenId:
      'ibc45c001a5ae212d09879be4627c45b64d5636086285590d5145a51e18e9d16722'
  },
  {
    pluginId: 'coreum',
    tokenId:
      'ibcab305490f17eccae3f2b0398a572e0efb3af394b90c3a1663da28c1f0869f624'
  },
  {
    pluginId: 'coreum',
    tokenId:
      'ibc64ada1661e3c1a4293e3bb15d5bd13012d0db3d9002c117c30d7c429a32f4d51'
  },
  {
    pluginId: 'coreum',
    tokenId:
      'ibc078eaf11288a47609fd894070ca8a1bfcebd9e08745ea7030f95d7adee2e22ca'
  },
  {
    pluginId: 'coreum',
    tokenId:
      'ibc81bd95b0890b8d0130755e8338cf4aa48c7cbbd149c1d66ec9f9b62afae5c4f3'
  },
  {
    pluginId: 'coreum',
    tokenId:
      'ibc12b178a885fc6891e0e09e1fb013973c5632b7093ce52d8f33b32e76e3bb6ea1'
  },
  {
    pluginId: 'coreum',
    tokenId:
      'ibcf8ca5236869f819bc006eef088e67889a26e4140339757878f0f4e229cdda858'
  },
  { pluginId: 'cardano', tokenId: null },
  { pluginId: 'ethereum', tokenId: '054c9d4c6f4ea4e14391addd1812106c97d05690' },
  { pluginId: 'ethereum', tokenId: 'a462bde22d98335e18a21555b6752db93a937cff' },
  { pluginId: 'ethereum', tokenId: '455e53cbb86018ac2b8092fdcd39d8444affc3f6' },
  { pluginId: 'ton', tokenId: null },
  { pluginId: 'sui', tokenId: null },
  { pluginId: 'axelar', tokenId: null },
  { pluginId: 'zano', tokenId: null },
  { pluginId: 'thorchainrune', tokenId: 'tcy' }
]
export const defaultFiat: string[] = [
  'ALL',
  'XCD',
  'EUR',
  'BBD',
  'BTN',
  'BND',
  'XAF',
  'CUP',
  'USD',
  'FKP',
  'GIP',
  'HUF',
  'IRR',
  'JMD',
  'AUD',
  'LAK',
  'LYD',
  'MKD',
  'XOF',
  'NZD',
  'OMR',
  'PGK',
  'RWF',
  'WST',
  'RSD',
  'SEK',
  'TZS',
  'AMD',
  'BSD',
  'BAM',
  'CVE',
  'CNY',
  'CRC',
  'CZK',
  'ERN',
  'GEL',
  'HTG',
  'INR',
  'JOD',
  'KRW',
  'LBP',
  'MWK',
  'MRO',
  'MZN',
  'ANG',
  'PEN',
  'QAR',
  'STD',
  'SLL',
  'SOS',
  'SDG',
  'SYP',
  'AOA',
  'AWG',
  'BHD',
  'BZD',
  'BWP',
  'BIF',
  'KYD',
  'COP',
  'DKK',
  'GTQ',
  'HNL',
  'IDR',
  'ILS',
  'KZT',
  'KWD',
  'LSL',
  'MYR',
  'MUR',
  'MNT',
  'MMK',
  'NGN',
  'PAB',
  'PHP',
  'RON',
  'SAR',
  'SGD',
  'ZAR',
  'SRD',
  'TWD',
  'TOP',
  'VEF',
  'DZD',
  'ARS',
  'AZN',
  'BYR',
  'BOB',
  'BGN',
  'CAD',
  'CLP',
  'CDF',
  'DOP',
  'FJD',
  'GMD',
  'GYD',
  'ISK',
  'IQD',
  'JPY',
  'KPW',
  'LVL',
  'CHF',
  'MGA',
  'MDL',
  'MAD',
  'NPR',
  'NIO',
  'PKR',
  'PYG',
  'SHP',
  'SCR',
  'SBD',
  'LKR',
  'THB',
  'TRY',
  'AED',
  'VUV',
  'YER',
  'AFN',
  'BDT',
  'BRL',
  'KHR',
  'KMF',
  'HRK',
  'DJF',
  'EGP',
  'ETB',
  'XPF',
  'GHS',
  'GNF',
  'HKD',
  'XDR',
  'KES',
  'KGS',
  'LRD',
  'MOP',
  'MVR',
  'MXN',
  'NAD',
  'NOK',
  'PLN',
  'RUB',
  'SZL',
  'TJS',
  'TTD',
  'UGX',
  'UYU',
  'VND',
  'TND',
  'UAH',
  'UZS',
  'TMT',
  'GBP',
  'ZMW',
  'BYN',
  'BMD',
  'GGP',
  'CLF',
  'CUC',
  'IMP',
  'JEP',
  'SVC',
  'ZMK',
  'XAG',
  'ZWL'
]

export const defaultTokenTypes: TokenTypeMap = {
  abstract: 'evm',
  algorand: 'simple',
  arbitrum: 'evm',
  avalanche: 'evm',
  axelar: 'cosmos',
  base: 'evm',
  binance: null,
  binancesmartchain: 'evm',
  bitcoin: null,
  bitcoincash: null,
  bitcoingold: null,
  bitcoinsv: null,
  bobevm: 'evm',
  botanix: 'evm',
  cardano: null,
  celo: 'evm',
  coreum: 'cosmos',
  cosmoshub: 'cosmos',
  dash: null,
  digibyte: null,
  dogecoin: null,
  eboost: null,
  ecash: null,
  eos: null,
  ethereum: 'evm',
  ethereumclassic: 'evm',
  ethereumpow: 'evm',
  fantom: 'evm',
  feathercoin: null,
  filecoin: null,
  filecoinfevm: 'evm',
  fio: null,
  groestlcoin: null,
  hedera: null,
  hyperevm: 'evm',
  liberland: 'simple',
  litecoin: null,
  monero: null,
  optimism: 'evm',
  osmosis: 'cosmos',
  piratechain: null,
  pivx: null,
  polkadot: null,
  polygon: 'evm',
  pulsechain: 'evm',
  qtum: null,
  ravencoin: null,
  ripple: 'xrpl',
  rsk: 'evm',
  smartcash: null,
  solana: 'simple',
  sonic: 'evm',
  stellar: null,
  sui: 'colon-delimited',
  telos: null,
  tezos: null,
  thorchainrune: 'cosmos',
  ton: null,
  tron: 'simple',
  ufo: null,
  vertcoin: null,
  wax: null,
  zano: 'lowercase',
  zcash: null,
  zcoin: null,
  zksync: 'evm'
}

export const defaultNetworkLocationTypes: NetworkLocationTypeMap = {
  ripple: 'xrpl',
  solana: 'solana'
}

export const defaultPlatformPriority: Record<string, number> = {
  bitcoin: 10,
  ethereum: 20,
  solana: 30,
  arbitrum: 40,
  base: 50,
  optimism: 60,
  zksync: 70,
  bobevm: 80,
  ripple: 90,
  binancesmartchain: 100,
  tron: 110,
  dogecoin: 120,
  cardano: 130,
  hyperevm: 140,
  stellar: 150,
  sui: 160,
  bitcoincash: 170,
  avalanche: 180,
  hedera: 190,
  litecoin: 200,
  ton: 210,
  polkadot: 220,
  monero: 230,
  ethereumclassic: 240,
  algorand: 250,
  cosmoshub: 260,
  filecoin: 270,
  filecoinfevm: 280,
  sonic: 290,
  tezos: 300,
  zcash: 310,
  bitcoinsv: 320,
  thorchainrune: 330,
  ecash: 340,
  qtum: 350,
  eos: 360,
  polygon: 370,
  rsk: 380,
  axelar: 390,
  dash: 400,
  zano: 410,
  ravencoin: 420,
  celo: 430,
  ethereumpow: 440,
  digibyte: 450,
  osmosis: 460,
  coreum: 470,
  piratechain: 480,
  telos: 490,
  groestlcoin: 500,
  fio: 510,
  pivx: 520,
  zcoin: 530,
  bitcoingold: 540,
  liberland: 550,
  feathercoin: 560,
  pulsechain: 570,
  smartcash: 580,
  binance: 590,
  fantom: 600,
  abstract: 610,
  botanix: 620
}

export const defaultCrossChainMapping: CrossChainMapping = {
  amoy: {
    sourceChain: 'amoy',
    destChain: 'polygon',
    currencyCode: 'POL',
    tokenId: null
  },
  bitcointestnet: {
    sourceChain: 'bitcointestnet',
    destChain: 'bitcoin',
    currencyCode: 'TESTBTC',
    tokenId: null
  },
  bitcointestnet4: {
    sourceChain: 'bitcointestnet4',
    destChain: 'bitcoin',
    currencyCode: 'TESTBTC',
    tokenId: null
  },
  filecoinfevmcalibration: {
    sourceChain: 'filecoinfevmcalibration',
    destChain: 'filecoin',
    currencyCode: 'tFIL',
    tokenId: null
  },
  sepolia: {
    sourceChain: 'sepolia',
    destChain: 'ethereum',
    currencyCode: 'ETH',
    tokenId: null
  },
  thorchainrunestagenet: {
    sourceChain: 'thorchainrunestagenet',
    destChain: 'thorchainrune',
    currencyCode: 'RUNE',
    tokenId: null
  },
  thorchainrunestagenet_tcy: {
    sourceChain: 'thorchainrunestagenet',
    destChain: 'thorchainrune',
    currencyCode: 'TCY',
    tokenId: 'tcy'
  }
}

export const defaultTokenOverrides: Record<string, TokenOverride[]> = {
  ripple: [
    {
      currencyCode: 'RLUSD',
      displayName: 'Ripple USD',
      decimals: 18,
      networkLocation: {
        currency: '524C555344000000000000000000000000000000',
        issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'
      }
    },
    {
      currencyCode: 'SOLO',
      displayName: 'Sologenic',
      decimals: 18,
      networkLocation: {
        currency: '534F4C4F00000000000000000000000000000000',
        issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz'
      }
    },
    {
      currencyCode: 'USD',
      displayName: 'Gatehub USD',
      decimals: 18,
      networkLocation: {
        currency: 'USD',
        issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq'
      }
    },
    {
      currencyCode: 'EUR',
      displayName: 'Gatehub EUR',
      decimals: 18,
      networkLocation: {
        currency: 'EUR',
        issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq'
      }
    },
    {
      currencyCode: 'USD',
      displayName: 'Bitstamp USD',
      decimals: 18,
      networkLocation: {
        currency: 'USD',
        issuer: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B'
      }
    },
    {
      currencyCode: 'EUR',
      displayName: 'Bitstamp EUR',
      decimals: 18,
      networkLocation: {
        currency: 'EUR',
        issuer: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B'
      }
    },
    {
      currencyCode: 'USD',
      displayName: 'Stably USD',
      decimals: 18,
      networkLocation: {
        currency: 'USD',
        issuer: 'rEn9eRkX25wfGPLysUMAvZ84jAzFNpT5fL'
      }
    },
    {
      currencyCode: 'USDC',
      displayName: 'USDC',
      decimals: 6,
      networkLocation: {
        currency: '5553444300000000000000000000000000000000',
        issuer: 'rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE'
      }
    },
    {
      currencyCode: 'CORE',
      displayName: 'Coreum',
      decimals: 18,
      networkLocation: {
        currency: '434F524500000000000000000000000000000000',
        issuer: 'rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D'
      }
    }
  ],
  solana: [
    {
      currencyCode: '$CWIF',
      displayName: 'catwifhat',
      decimals: 2,
      networkLocation: {
        contractAddress: '7atgF8KQo4wJrD5ATGX7t1V2zVvykPJbFfNeVf1icFv1',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'BIO',
      displayName: 'BIO',
      decimals: 9,
      networkLocation: {
        contractAddress: 'bioJ9JTqW62MLz7UKHU69gtKhPpGi1BQhccj2kmSvUJ',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'ABBVx',
      displayName: 'AbbVie xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XswbinNKyPmzTa5CskMbCPvMW6G5CMnZXZEeQSSQoie',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'ABTx',
      displayName: 'Abbott xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsHtf5RpxsQ7jeJ9ivNewouZKJHbPxhPoEy6yYvULr7',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'ACNx',
      displayName: 'Accenture xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xs5UJzmCRQ8DWZjskExdSQDnbE6iLkRu2jjrRAB1JSU',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'GOOGLx',
      displayName: 'Alphabet xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'AMZNx',
      displayName: 'Amazon xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'AMBRx',
      displayName: 'Amber xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsaQTCgebC2KPbf27KUhdv5JFvHhQ4GDAPURwrEhAzb',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'AAPLx',
      displayName: 'Apple xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'APPx',
      displayName: 'AppLovin xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsPdAVBi8Zc1xvv53k4JcMrQaEDTgkGqKYeh7AYgPHV',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'AZNx',
      displayName: 'AstraZeneca xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xs3ZFkPYT2BN7qBMqf1j1bfTeTm1rFzEFSsQ1z3wAKU',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'BACx',
      displayName: 'Bank of America xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XswsQk4duEQmCbGzfqUUWYmi7pV7xpJ9eEmLHXCaEQP',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'BRK.Bx',
      displayName: 'Berkshire Hathaway xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'AVGOx',
      displayName: 'Broadcom xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'CVXx',
      displayName: 'Chevron xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsNNMt7WTNA2sV3jrb1NNfNgapxRF5i4i6GcnTRRHts',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'CRCLx',
      displayName: 'Circle xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'CSCOx',
      displayName: 'Cisco xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xsr3pdLQyXvDJBFgpR5nexCEZwXvigb8wbPYp4YoNFf',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'KOx',
      displayName: 'Coca-Cola xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'COINx',
      displayName: 'Coinbase xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'CMCSAx',
      displayName: 'Comcast xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsvKCaNsxg2GN8jjUmq71qukMJr7Q1c5R2Mk9P8kcS8',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'CRWDx',
      displayName: 'CrowdStrike xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xs7xXqkcK7K8urEqGg52SECi79dRp2cEKKuYjUePYDw',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'DHRx',
      displayName: 'Danaher xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xseo8tgCZfkHxWS9xbFYeKFyMSbWEvZGFV1Gh53GtCV',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'DFDVx',
      displayName: 'DFDV xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xs2yquAgsHByNzx68WJC55WHjHBvG9JsMB7CWjTLyPy',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'LLYx',
      displayName: 'Eli Lilly xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xsnuv4omNoHozR6EEW5mXkw8Nrny5rB3jVfLqi6gKMH',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'XOMx',
      displayName: 'Exxon Mobil xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsaHND8sHyfMfsWPj6kSdd5VwvCayZvjYgKmmcNL5qh',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'GMEx',
      displayName: 'Gamestop xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'GLDx',
      displayName: 'Gold xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'GSx',
      displayName: 'Goldman Sachs xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsgaUyp4jd1fNBCxgtTKkW64xnnhQcvgaxzsbAq5ZD1',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'HDx',
      displayName: 'Home Depot xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XszjVtyhowGjSC5odCqBpW1CtXXwXjYokymrk7fGKD3',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'HONx',
      displayName: 'Honeywell xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsRbLZthfABAPAfumWNEJhPyiKDW6TvDVeAeW7oKqA2',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'INTCx',
      displayName: 'Intel xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'IBMx',
      displayName: 'International Business Machines xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XspwhyYPdWVM8XBHZnpS9hgyag9MKjLRyE3tVfmCbSr',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'JNJx',
      displayName: 'Johnson & Johnson xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsGVi5eo1Dh2zUpic4qACcjuWGjNv8GCt3dm5XcX6Dn',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'JPMx',
      displayName: 'JPMorgan Chase xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsMAqkcKsUewDrzVkait4e5u4y8REgtyS7jWgCpLV2C',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'LINx',
      displayName: 'Linde xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsSr8anD1hkvNMu8XQiVcmiaTP7XGvYu7Q58LdmtE8Z',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'MRVLx',
      displayName: 'Marvell xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsuxRGDzbLjnJ72v74b7p9VY6N66uYgTCyfwwRjVCJA',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'MAx',
      displayName: 'Mastercard xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsApJFV9MAktqnAc6jqzsHVujxkGm9xcSUffaBoYLKC',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'MCDx',
      displayName: "McDonald's xStock",
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'MDTx',
      displayName: 'Medtronic xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsDgw22qRLTv5Uwuzn6T63cW69exG41T6gwQhEK22u2',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'MRKx',
      displayName: 'Merck xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsnQnU7AdbRZYe2akqqpibDdXjkieGFfSkbkjX1Sd1X',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'METAx',
      displayName: 'Meta xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'MSFTx',
      displayName: 'Microsoft xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'MSTRx',
      displayName: 'MicroStrategy xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'QQQx',
      displayName: 'Nasdaq xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'NFLXx',
      displayName: 'Netflix xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'NVOx',
      displayName: 'Novo Nordisk xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsfAzPzYrYjd4Dpa9BU3cusBsvWfVB9gBcyGC87S57n',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'NVDAx',
      displayName: 'NVIDIA xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'ORCLx',
      displayName: 'Oracle xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'PLTRx',
      displayName: 'Palantir xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'PEPx',
      displayName: 'PepsiCo xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xsv99frTRUeornyvCfvhnDesQDWuvns1M852Pez91vF',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'PFEx',
      displayName: 'Pfizer xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsAtbqkAP1HJxy7hFDeq7ok6yM43DQ9mQ1Rh861X8rw',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'PMx',
      displayName: 'Philip Morris xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xsba6tUnSjDae2VcopDB6FGGDaxRrewFCDa5hKn5vT3',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'PGx',
      displayName: 'Procter & Gamble xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsYdjDjNUygZ7yGKfQaB6TxLh2gC6RRjzLtLAGJrhzV',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'HOODx',
      displayName: 'Robinhood xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'CRMx',
      displayName: 'Salesforce xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsczbcQ3zfcgAEt9qHQES8pxKAVG5rujPSHQEXi4kaN',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'SPYx',
      displayName: 'SP500 xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'TSLAx',
      displayName: 'Tesla xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'TMOx',
      displayName: 'Thermo Fisher xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xs8drBWy3Sd5QY3aifG9kt9KFs2K3PGZmx7jWrsrk57',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'TQQQx',
      displayName: 'TQQQ xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsjQP3iMAaQ3kQScQKthQpx9ALRbjKAjQtHg6TFomoc',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'UNHx',
      displayName: 'UnitedHealth xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XszvaiXGPwvk2nwb3o9C1CX4K6zH8sez11E6uyup6fe',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'VTIx',
      displayName: 'Vanguard xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsssYEQjzxBCFgvYFFNuhJFBeHNdLWYeUSP8F45cDr9',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'Vx',
      displayName: 'Visa xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'XsqgsbXwWogGJsNcVZ3TyVouy2MbTkfCFhCGGGcQZ2p',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'WMTx',
      displayName: 'Walmart xStock',
      decimals: 8,
      networkLocation: {
        contractAddress: 'Xs151QeqTCiuKtinzfRATnUESM2xTU6V9Wy8Vy538ci',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'SPINE',
      displayName: 'SpineDAO',
      decimals: 9,
      networkLocation: {
        contractAddress: 'spinezMPKxkBpf4Q9xET2587fehM3LuKe4xoAoXtSjR',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    },
    {
      currencyCode: 'PYUSD',
      displayName: 'PayPal USD',
      decimals: 6,
      networkLocation: {
        contractAddress: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
        tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      }
    }
  ]
}
