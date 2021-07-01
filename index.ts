import cheerio from 'cheerio'
import axios from 'axios'
import HtmlTableToJson from 'html-table-to-json'

const URL = 'https://www.uoguide.com/Soleil_Rouge'

const main = async () => {
    const response = await axios(URL)
    const $ = cheerio.load(response.data)
    const table = $('#mw-content-text table:first-child table')
    const data = HtmlTableToJson(table.html())
    console.log(data.results)
}

main()