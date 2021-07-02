import fs from 'fs'
import * as cheerio from 'cheerio'
import axios from 'axios'
// import * as jsonexport from "jsonexport/dist"
const HtmlTableToJson = require('html-table-to-json')

import slotsJson from './data/slots.json'
import skills from './data/skills.json'
import links from './data/broken-link.json'

const LEFT_HAND = 'Left Hand'

// const URL = 'https://www.uoguide.com/Soleil_Rouge'
// const URL = 'https://www.uoguide.com/Evocaricus_(Juggernaut_Set)'
// const URL = 'https://www.uoguide.com/Greymist_Armor_(Arms)'
// const URL = 'https://www.uoguide.com/Elven_Leafweave_(Leggings)'
// const URL = 'https://www.uoguide.com/Assassin_Armor_(Arms)'
// const URL = 'https://www.uoguide.com/Captain_Johne%27s_Blade'
// const URL = 'https://www.uoguide.com/Assassin_Armor_Set'

type Equipment = {
    [key: string]: string
}

type Pair = [string, (string|number|boolean)]

const writeJson = (jsonContent, filename) => {
    fs.writeFile(`./output/${filename}.json`, jsonContent, 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }
     
        console.log("JSON file has been saved.");
    });
}

const defaultGetter = (prop) => prop["1"]

const getters = {
    0: defaultGetter,
    1: (prop) => prop[Object.keys(prop)[0]],
    2: defaultGetter,
    3: defaultGetter
}

const prepareLayoutProps = (equip, layoutType) => {
    if (layoutType === 0) {
        const [ firstProp, ...props ] = equip
        return [props]
    }

    else if (layoutType === 1) {
        const key = Object.keys(equip[0])[0]
        const firstFullSetPropertyIndex = equip.findIndex(prop => isSetBonus.test(prop[key]))
        
        return [equip.slice(0, firstFullSetPropertyIndex), equip.slice(firstFullSetPropertyIndex)]
    }

    if (layoutType === 2) {
        const [ firstProp, ...props ] = equip
        return [props]
    }

    return [equip]
}

const hasTwoPoints = (prop) => {
    const regex = /:/
    return regex.test(prop)
}

const isWeaponSpeed = (prop) => {
    const regex = /weapon speed/i
    return regex.test(prop)
}

const isWeaponDamage = (prop) => {
    const regex = /weapon damage/i
    return regex.test(prop)
}

const isSkillBonus = (prop) => skills.some(skill => new RegExp(skill).test(prop))

const isSlayer = (prop) => {
    const regex = /slayer/i
    return regex.test(prop)
}

const isSetStatement = (prop) => {
    const regex = /part.*set.*pieces.*/i
    return regex.test(prop)
}

const isMageWeapon = (prop) => {
    const regex = /Mage Weapon/i
    return regex.test(prop)
}

const endsWithTotal = (prop) => {
    const regex = /\(total\)$/i
    return regex.test(prop)
}

const shouldIgnore = (prop) => {
    const regex = /^0 spells/i
    return regex.test(prop)
}


const isSetBonus = /Full Set/i

const getNo = (prop) => parseInt(prop.match(/[0-9]./))

const inferSlot = (str, props) => {
    if (Object.keys(props).some(str => /weapon/i.test(String(str)))) return LEFT_HAND

    for (let slot in slotsJson) {
        for (let type of slotsJson[slot]) {
            const regex = new RegExp(type)
            if (regex.test(str)) return slot
        }
    }
}

const transform = (props, getter) => props.reduce((obj, rawProp) => {
    let pair: Pair = ['', '']
    const prop = getter(rawProp)
    const lastChar = prop[prop.length - 1]

    const numberOrPercentage = /([0-9]|\%)/
    const lastSpace = / (?=[^ ]*$)/
    const spaceAfterDamage = /(?<=damage) /i
    const spaceBeforeNumber = / (?=[0-9])/i
    const spaceAfterNumber = /(?<=[0-9]) /i
    const spaceBeforeSlayer = / (?=slayer)/i
    const spaceAfterWeapon = /(?<=weapon) /i

    if (hasTwoPoints(prop)) {
        pair = prop.split(':').map(s => s.trim())
    }
    else if (shouldIgnore(prop)) return prop
    else if (isSkillBonus(prop)) {
        pair = prop.split(spaceAfterNumber).reverse()
    }
    else if (isMageWeapon(prop)) {
        pair = prop.split(spaceAfterWeapon)
    }
    else if (isSlayer(prop)) {
        pair = prop.split(spaceBeforeSlayer).reverse()
    }
    else if (isWeaponSpeed(prop)) {
        pair = prop.split(lastSpace)
    }
    else if (isWeaponDamage(prop)) {
        pair = prop.split(spaceAfterDamage)
    }
    else if (endsWithTotal(prop)) {
        pair = prop.split(spaceBeforeNumber)
    }
    else if (numberOrPercentage.test(lastChar)) {
        pair = prop.split(lastSpace)
    }
    else if (isSetStatement(prop)) {
        pair = ['Set total pieces', getNo(prop)]
    }
    else if (!prop) return obj
    else {
        pair = [prop, true]
    }

    return { ...obj, [pair[0]]: pair[1] }
}, {})

const parseResults = (tables: any[], opts): Equipment[] => {
    const { title: equipName, layoutType, firstP, secondTable, UOGuideLink } = opts
    const [ equip, setBonus ] = tables
    const getter = getters[layoutType]
    let results = []

    const [props, inferredSetBonus] = prepareLayoutProps(equip, layoutType)
    const transformedProps = transform(props, getter)
    const slot = inferSlot(firstP, transformedProps)
    results = results.concat({
        "Name": equipName,
        "Slot": slot,
        UOGuideLink,
        ...transformedProps
    })

    if (setBonus || inferredSetBonus || secondTable) {
        const [ firstProp, ...props ] = setBonus || inferredSetBonus || secondTable
        const title = getter(firstProp)

        if (isSetBonus.test(title)) {
            const setBonusProps = transform(props, getter)
            results = results.concat({
                "Name": `${equipName} Full Set Bonus`,
                "From": equipName,
                "Slot": "Full Set Bonus",
                ...setBonusProps
            })
        }

        else {
            const equip2Props = transform(props, getter)
            results = results.concat({
                "Name": `${equipName} 2`,
                "Slot": slot,
                UOGuideLink,
                ...equip2Props
            })
        }
    }

    return results
}

const main = async (URL: string) => {
    const response = await axios(URL)
    const $ = cheerio.load(response.data)
    let layoutType: (number|boolean) = false
    let secondTable
    
    const title = $('h1').html()
    const tableEl0 = $('#mw-content-text > table:first-child table')
    const tableEl1 = $('#mw-content-text > table:first-child table#tooltip')
    const tableEl2 = $('#mw-content-text > table:first-child')
    const tableEl3 = $('#mw-content-text > .thumb:first-child + table')

    if (tableEl1.length) layoutType = 1
    else if (tableEl0.length) layoutType = 0
    else if (tableEl2.length) layoutType = 2
    else if (tableEl3.length) layoutType = 3

    if (layoutType === false) {
        const error = `Layout doesn't match`
        console.error(`${error} - ${URL}`)
        return { error }
    }

    const tables = {
        0: tableEl0,
        1: tableEl1,
        2: tableEl2,
        3: tableEl3,
    }
    
    const firstP = $('#mw-content-text > p:first-of-type').eq(0).text()
    const table = $('<table>').append(tables[layoutType as number].clone()).html();
    if (layoutType === 2) secondTable = $('<table>').append($('#mw-content-text > table:first-child + table').clone()).html();
    const data = new HtmlTableToJson(table)
    if (secondTable) secondTable = new HtmlTableToJson(secondTable).results[0]
    const parsed = parseResults(data.results, { layoutType, title, firstP, secondTable, UOGuideLink: URL })

    return { data: parsed }
}

const loop = async () => {
    let res = []
    let err = {}

    for (let item in links) {
        try {
            const { data, error } = await main(links[item])

            if (error) {
                err[item] = {
                    link: links[item],
                    error: {
                        statusText: error
                    },
                }
            }
            
            if (data) {
                console.log(`${item}: fetch succeeded!`)
                res = [...res, ...data]
            }
        } catch({ response: { status, statusText } }) {
            err[item] = {
                link: links[item],
                error: {
                    status,
                    statusText
                }
            }
        }
    }

    writeJson(JSON.stringify(res), 'data')
    writeJson(JSON.stringify(err), 'errors')
}

loop()

// const handler = async function (event, context, callback) {
//     const data = await main()

//     const res = {
//         "statusCode": 200,
//         "body": JSON.stringify(data),
//         "isBase64Encoded": false
//     };
//     callback(null, res);
// }

// exports.handler = main