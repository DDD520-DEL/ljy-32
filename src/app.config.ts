export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/record/index',
    'pages/rank/index',
    'pages/collaborate/index',
    'pages/share/index',
    'pages/detail/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FF6B35',
    navigationBarTitleText: '声控灯评测',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F8FAFC'
  },
  tabBar: {
    color: '#64748B',
    selectedColor: '#FF6B35',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页'
      },
      {
        pagePath: 'pages/record/index',
        text: '测试记录'
      },
      {
        pagePath: 'pages/rank/index',
        text: '排行榜'
      },
      {
        pagePath: 'pages/collaborate/index',
        text: '邻里协作'
      },
      {
        pagePath: 'pages/share/index',
        text: '投诉分享'
      }
    ]
  }
})
