import { mainModule } from 'process'
import json from './data/slots.json'

const str = "This part of the Acolyte Armor Set is a pair of Leather Sleeves. \n"

const main = () => {
    const getSlot = () => {
        for (let slot in json) {
            for (let type of json[slot]) {
                const regex = new RegExp(type)
                if (regex.test(str)) return slot
            }
        }
    }

    console.log(getSlot())
}

main()