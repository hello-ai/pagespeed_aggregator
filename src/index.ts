const PAGE_SPEED_INSIGHTS_API_ROOT =
  'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const API_KEY = 'AIzaSyAxtgni5zo66IoyG8bZCgDOu7DrGFq5opQ'

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

const CORE_WEB_VITALS_API_ROOT = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord'
const CORE_WEB_VITALS_API_KEY = 'AIzaSyDHDzU5CBLZiiN51UA6d-OLnnl34RoaIN4'

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

type TValue = {
  performance: string
  fcpScore: string
  siScore: string
  lcpScore: string
  tbtScore: string
  clsScore: string
  fcpTime: string
  siTime: string
  lcpTime: string
  tbtTime: string
  clsValue: string
}

type TMetrics = {
  histogram: Array<{
    start: number
    end: number
    density: number
  }>
  percentiles: {
    p75: number
  }
}

type TCoreWebVitals = {
  record: {
    metrics: {
      first_contentful_paint: TMetrics
      first_input_delay: TMetrics
      interaction_to_next_paint: TMetrics
      largest_contentful_paint: TMetrics
      cumulative_layout_shift: TMetrics
      experimental_time_to_first_byte: TMetrics
    }
  }
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

const getPageSpeedResults3Times = (url: string): PageSpeedModel[] => {
  // UrlFetchAppのfetchAllを使い、3回fetchし、その平均値を取得する
  Logger.log(`3 times fetch ${url}`)

  const responses = UrlFetchApp.fetchAll([
    `${PAGE_SPEED_INSIGHTS_API_ROOT}?url=${url}&category=performance&strategy=mobile&key=${API_KEY}`,
    `${PAGE_SPEED_INSIGHTS_API_ROOT}?url=${url}&category=performance&strategy=mobile&key=${API_KEY}`,
    `${PAGE_SPEED_INSIGHTS_API_ROOT}?url=${url}&category=performance&strategy=mobile&key=${API_KEY}`,
  ])

  return responses.map((v) => JSON.parse(v.getContentText()) as PageSpeedModel)
}


const getPageSpeedResult = (url: string): PageSpeedModel => {
  Logger.log(`fetch once ${url}`)
  const response = UrlFetchApp.fetch(
    `${PAGE_SPEED_INSIGHTS_API_ROOT}?url=${url}&category=performance&strategy=mobile&key=${API_KEY}`,
    {}
  )

  const pagespeedResult = JSON.parse(
    response.getContentText()
  ) as PageSpeedModel

  return pagespeedResult
}

const getCoreWebVitals = () => {
  const origin = 'https://autoreserve.com'

  Logger.log(`fetch ${origin} as core web vitals`)

  const spreadSheet = new SpreadSheet()
  const sheet = spreadSheet.sheetByName('Core Web Vitals')

  const body = {
    origin,
    "formFactor": "PHONE"
  }

  const options = {
    method: 'post' as any,
    contentType: 'application/json',
    payload: JSON.stringify(body)
  }

  // POST APIを実行
  const response = UrlFetchApp.fetch(`${CORE_WEB_VITALS_API_ROOT}?key=${CORE_WEB_VITALS_API_KEY}`, options)
  const corewebVitals = JSON.parse(response.getContentText()) as TCoreWebVitals

  const { metrics } = corewebVitals.record

  const date = new Date()
    .toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .split('/')
    .join('/')

  Logger.log(metrics.first_contentful_paint)

  const values = {
    fcp: metrics.first_contentful_paint.percentiles.p75,
    fid: metrics.first_input_delay.percentiles.p75,
    inp: metrics.interaction_to_next_paint.percentiles.p75,
    lcp: metrics.largest_contentful_paint.percentiles.p75,
    cls: metrics.cumulative_layout_shift.percentiles.p75,
    ttfb: metrics.experimental_time_to_first_byte.percentiles.p75,
    fcpGreen: metrics.first_contentful_paint.histogram[0].density,
    fcpYellow: metrics.first_contentful_paint.histogram[1].density,
    fcpRed: metrics.first_contentful_paint.histogram[2].density,
    fidGreen: metrics.first_input_delay.histogram[0].density,
    fidYellow: metrics.first_input_delay.histogram[1].density,
    fidRed: metrics.first_input_delay.histogram[2].density,
    inpGreen: metrics.interaction_to_next_paint.histogram[0].density,
    inpYellow: metrics.interaction_to_next_paint.histogram[1].density,
    inpRed: metrics.interaction_to_next_paint.histogram[2].density,
    lcpGreen: metrics.largest_contentful_paint.histogram[0].density,
    lcpYellow: metrics.largest_contentful_paint.histogram[1].density,
    lcpRed: metrics.largest_contentful_paint.histogram[2].density,
    clsGreen: metrics.cumulative_layout_shift.histogram[0].density,
    clsYellow: metrics.cumulative_layout_shift.histogram[1].density,
    clsRed: metrics.cumulative_layout_shift.histogram[2].density,
    ttfbGreen: metrics.experimental_time_to_first_byte.histogram[0].density,
    ttfbYellow: metrics.experimental_time_to_first_byte.histogram[1].density,
    ttfbRed: metrics.experimental_time_to_first_byte.histogram[2].density,
  }

  // valuesをシート最後の行に追加
  sheet.appendRow(
    Object.values({
      date,
      ...values,
    })
  )
}


function batch() {
  getCoreWebVitals()

  const spreadSheet = new SpreadSheet()

  // 検査対象のURL一覧を取得
  const urlList = getTargetUrls()

  urlList.forEach((v, index) => {
    const sheet = spreadSheet.sheetByName(v.name)

    const isAutoReserveUrl = v.url.includes('autoreserve.com')

    const date = new Date()
      .toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .split('/')
      .join('/')

    let values: TValue

    // autoreserveの検証は3回の平均を取る
    if (isAutoReserveUrl) {
      const pagespeedResults = getPageSpeedResults3Times(v.url)

      const vArray: TValue[] = []
      pagespeedResults.forEach((result) => {
        const { categories, audits } = result.lighthouseResult

        vArray.push({
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
        })
      })

      // vArrayのkeyそれぞれの平均値を計算。vArray.lengthで割る
      values = {
        performance: (
          vArray.reduce((acc, cur) => acc + parseInt(cur.performance), 0) /
          vArray.length
        ).toFixed(0),
        fcpScore: (
          vArray.reduce((acc, cur) => acc + parseFloat(cur.fcpScore), 0) /
          vArray.length
        ).toFixed(1),
        siScore: (
          vArray.reduce((acc, cur) => acc + parseFloat(cur.siScore), 0) /
          vArray.length
        ).toFixed(1),
        lcpScore: (
          vArray.reduce((acc, cur) => acc + parseFloat(cur.lcpScore), 0) /
          vArray.length
        ).toFixed(1),
        tbtScore: (
          vArray.reduce((acc, cur) => acc + parseFloat(cur.tbtScore), 0) /
          vArray.length
        ).toFixed(1),
        clsScore: (
          vArray.reduce((acc, cur) => acc + parseFloat(cur.clsScore), 0) /
          vArray.length
        ).toFixed(1),
        fcpTime: (
          vArray.reduce((acc, cur) => acc + parseFloat(cur.fcpTime), 0) /
          vArray.length
        ).toFixed(1),
        siTime: (
          vArray.reduce((acc, cur) => acc + parseFloat(cur.siTime), 0) /
          vArray.length
        ).toFixed(1),
        lcpTime: (
          vArray.reduce((acc, cur) => acc + parseFloat(cur.lcpTime), 0) /
          vArray.length
        ).toFixed(1),
        tbtTime: (
          vArray.reduce((acc, cur) => acc + parseFloat(cur.tbtTime), 0) /
          vArray.length
        ).toFixed(1),
        clsValue: (
          vArray.reduce((acc, cur) => acc + parseFloat(cur.clsValue), 0) /
          vArray.length
        ).toFixed(1),
      }
    } else {
      const pagespeedResult = getPageSpeedResult(v.url)

      const { categories, audits } = pagespeedResult.lighthouseResult

      values = {
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

    }


    // valuesをシート最後の行に追加
    sheet.appendRow(
      Object.values({
        date,
        ...values,
      })
    )

    Logger.log(`${v.name} score ${values.performance}`)
    Logger.log(`Done: ${index + 1} / ${urlList.length}`)
  })
}
