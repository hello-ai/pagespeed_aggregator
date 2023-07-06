const PAGE_SPEED_INSIGHTS_API_ROOT =
  'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const API_KEY = 'AIzaSyCog6kpgc-wIGVWehXTIQ3dBtZsRPcOMnQ'

const INITIAL_COLUMN_NAMES = [
  '日付',
  'Performance',
  'FCP score',
  'SI score',
  'LCP score',
  'TBT score',
  'CLS score',
  'FCP time(ms)',
  'SI time(ms)',
  'LCP time(ms)',
  'TBT time(ms)',
  'CLS value',
]

type Distribution = {
  min: number
  max: number
  proportion: number
}

type Metric = {
  percentile: number
  distributions: Distribution[]
  category: string
}

type LoadingExperience = {
  id: string
  metrics: Record<string, Metric>
  overall_category: string
  initial_url: string
}

type LighthouseConfigSettings = {
  emulatedFormFactor: string
  locale: string
  onlyCategories: string[]
}

type Audit = {
  id: string
  title: string
  description: string
  score: number
  scoreDisplayMode: string
  displayValue: string
  explanation: string
  errorMessage: string
  warnings: any[]
  details: Record<string, any>
  numericValue: number
}

type CategoryAuditRef = {
  id: string
  weight: number
  group: string
}

type Category = {
  id: string
  title: string
  description: string
  score: number
  manualDescription: string
  auditRefs: CategoryAuditRef[]
}

type CategoryGroup = {
  title: string
  description: string
}

type LighthouseResult = {
  requestedUrl: string
  finalUrl: string
  lighthouseVersion: string
  userAgent: string
  fetchTime: string
  environment: {
    networkUserAgent: string
    hostUserAgent: string
    benchmarkIndex: number
  }
  runWarnings: any[]
  configSettings: LighthouseConfigSettings
  audits: Record<string, Audit>
  categories: Record<string, Category>
  categoryGroups: Record<string, CategoryGroup>
  runtimeError: {
    code: string
    message: string
  }
  timing: {
    total: number
  }
  i18n: {
    rendererFormattedStrings: {
      varianceDisclaimer: string
      opportunityResourceColumnLabel: string
      opportunitySavingsColumnLabel: string
      errorMissingAuditInfo: string
      errorLabel: string
      warningHeader: string
      auditGroupExpandTooltip: string
      passedAuditsGroupTitle: string
      notApplicableAuditsGroupTitle: string
      manualAuditsGroupTitle: string
      toplevelWarningsMessage: string
      scorescaleLabel: string
      crcLongestDurationLabel: string
      crcInitialNavigation: string
      lsPerformanceCategoryDescription: string
      labDataTitle: string
    }
  }
}

type Version = {
  major: number
  minor: number
}

type PageSpeedModel = {
  captchaResult: string
  kind: 'pagespeedonline#result'
  id: string
  loadingExperience: LoadingExperience
  originLoadingExperience: LoadingExperience
  lighthouseResult: LighthouseResult
  analysisUTCTimestamp: string
  version: Version
}

class SpreadSheet {
  private spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet

  constructor() {
    this.spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  }

  get urlListSheet() {
    return this.spreadsheet.getSheetByName('URLs')
  }

  sheetByName(name: string) {
    const sheet = this.spreadsheet.getSheetByName(name)

    if (sheet != null) {
      return sheet
    }

    const newSheet = this.spreadsheet.insertSheet(name)

    // newSheetの一行目に初期値を入れる
    const range = newSheet.getRange(1, 1, 1, INITIAL_COLUMN_NAMES.length)
    range.setValues([INITIAL_COLUMN_NAMES])

    return newSheet
  }
}

const getTargetUrls = () => {
  const spreadsheet = new SpreadSheet()
  const sheet = spreadsheet.urlListSheet

  if (sheet == null) {
    return []
  }

  // A,B列の値を取得
  const range = sheet.getRange(1, 1, sheet.getLastRow(), 2)

  return range.getValues().map((v) => ({
    name: v[0] as string,
    url: v[1] as string,
  }))
}

const getPageSpeedResult = (url: string, lastPerformanceScore: string, isRetry = false): PageSpeedModel => {
  const response = UrlFetchApp.fetch(
    `${PAGE_SPEED_INSIGHTS_API_ROOT}?url=${url}&category=performance&strategy=mobile&key=${API_KEY}`,
    {}
  )

  const pagespeedResult = JSON.parse(
    response.getContentText()
  ) as PageSpeedModel

  const { categories } = pagespeedResult.lighthouseResult

  const performanceScore = (categories.performance.score * 100).toFixed(0)

  // performanceScoreとlastPerformanceScoreが10点差以上の場合は再実行する。再実行は1回まで
  if (!isRetry && Math.abs(parseInt(performanceScore) - parseInt(lastPerformanceScore)) >= 10) {
    // 2秒待つ
    Utilities.sleep(2000)

    return getPageSpeedResult(url, lastPerformanceScore, true)
  }

  return pagespeedResult
}

function batch() {
  const spreadSheet = new SpreadSheet()

  // 検査対象のURL一覧を取得
  const urlList = getTargetUrls()

  urlList.forEach((v, index) => {
    const sheet = spreadSheet.sheetByName(v.name)

    // 最後の行のPerformanceの値を取得
    const lastRow = sheet.getLastRow()
    const lastPerformance = sheet.getRange(lastRow, 2).getValue() as string

    const pagespeedResult = getPageSpeedResult(v.url, lastPerformance)

    const { categories, audits } = pagespeedResult.lighthouseResult

    const date = new Date()
      .toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .split('/')
      .join('/')

    const values = {
      date,
      performance: (categories.performance.score * 100).toFixed(0),
      fcpScore: (
        audits['first-contentful-paint'].score *
        categories.performance.auditRefs.filter(
          (v) => v.id === 'first-contentful-paint'
        )[0].weight
      ).toFixed(1),
      siScore: (
        audits['speed-index'].score *
        categories.performance.auditRefs.filter(
          (v) => v.id === 'speed-index'
        )[0].weight
      ).toFixed(1),
      lcpScore: (
        audits['largest-contentful-paint'].score *
        categories.performance.auditRefs.filter(
          (v) => v.id === 'largest-contentful-paint'
        )[0].weight
      ).toFixed(1),
      tbtScore: (
        audits['total-blocking-time'].score *
        categories.performance.auditRefs.filter(
          (v) => v.id === 'total-blocking-time'
        )[0].weight
      ).toFixed(1),
      clsScore: (
        audits['cumulative-layout-shift'].score *
        categories.performance.auditRefs.filter(
          (v) => v.id === 'cumulative-layout-shift'
        )[0].weight
      ).toFixed(1),
      fcpTime: audits['first-contentful-paint'].numericValue.toFixed(1),
      siTime: audits['speed-index'].numericValue.toFixed(1),
      lcpTime: audits['largest-contentful-paint'].numericValue.toFixed(1),
      tbtTime: audits['total-blocking-time'].numericValue.toFixed(1),
      clsValue: audits['cumulative-layout-shift'].numericValue.toFixed(1),
    }

    // valuesをシート最後の行に追加
    sheet.appendRow(Object.values(values))

    Logger.log(`${v.name} score ${values.performance}`)
    Logger.log(`Done: ${index + 1} / ${urlList.length}`)
  })
}
