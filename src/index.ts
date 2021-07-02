import cheerio from 'cheerio'
import axios from 'axios'
import HtmlTableToJson from 'html-table-to-json'
// import { Tabletojson as tabletojson } from 'tabletojson'
import tableToCsv from 'node-table-to-csv'
import { compareDocumentPosition } from 'domutils'

const URL = 'https://www.uoguide.com/Soleil_Rouge'

type Equipment = {
    [key: string]: string
}

const parseResults = (tables: any[]): Equipment[] => {
    const [ equip, setBonus ] = tables
    const [ { '1': equipName }, ...props ] = equip
    let results = []

    const numberOrPercentage = /([0-9]|\%)/
    const hasTwoPoints = /:/
    const lastSpace = / (?=[^ ]*$)/
    const isSetBonus = /Full Set Bonuses/i

    const transform = (props) => props.reduce((obj, { '1': prop }) => {
        let pair = ['', '']
        const lastChar = prop[prop.length - 1]

        if (numberOrPercentage.test(lastChar)) {
            pair = prop.split(lastSpace)
        }
        else if (hasTwoPoints.test(prop)) {
            pair = prop.split(':').map(s => s.trim())
        }
        else {
            return { ...obj, "Extras": [...(obj["Extras"] || []), prop] }
        }

        return { ...obj, [pair[0]]: pair[1] }
    }, {})

    const transformedProps = transform(props)
    console.log(transformedProps)
    results = results.concat({ "Name": equipName, ...transformedProps })

    if (setBonus) {
        const [ { '1': title }, ...props ] = setBonus

        if (isSetBonus.test(title)) {
            const setBonusProps = transform(props)
            results = results.concat({ "Name": `${equipName} Full Set Bonus`, "From": equipName, setBonusProps})
        }
    }

    return results
}

const main = async () => {
    const response = await axios(URL)
    const $ = cheerio.load(response.data)
    
    const table = $('<table>').append($('#mw-content-text table:first-child table').clone()).html();
    
    const data = HtmlTableToJson.parse(table)
    console.log(data.results)
    const parsed = parseResults(data.results)
    console.log(parsed)
}

main()