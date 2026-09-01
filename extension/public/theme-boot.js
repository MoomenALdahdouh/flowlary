;(function () {
  try {
    var stored = localStorage.getItem('flowlary-theme')
    var theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f7fb' : '#05070b')
  } catch (e) {}
})()
