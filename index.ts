import * as cheerio from 'cheerio'
import axios from 'axios'
const HtmlTableToJson = require('html-table-to-json')

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
    results = results.concat({ "Name": equipName, ...transformedProps })

    if (setBonus) {
        const [ { '1': title }, ...props ] = setBonus

        if (isSetBonus.test(title)) {
            const setBonusProps = transform(props)
            results = results.concat({ "Name": `${equipName} Full Set Bonus`, "From": equipName, ...setBonusProps})
        }
    }

    return results
}

exports.handler = async function (event, context, callback) {
    const response = await axios(URL)
    const $ = cheerio.load(response.data)
    
    const table = $('<table>').append($('#mw-content-text table:first-child table').clone()).html();
    
    const data = new HtmlTableToJson(table)
    const parsed = parseResults(data.results)

    const res = {
        "statusCode": 200,
        "body": JSON.stringify(parsed),
        "isBase64Encoded": false
    };
    callback(null, res);
}