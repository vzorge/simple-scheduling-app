import type {Person} from '$lib/Person';
import {json} from '@sveltejs/kit';
import {Match} from '$lib/MatchingResponse';
import type { Times } from '$lib/Times';

export async function POST({ request }) {
    console.log('MADE IT to the POST');
    const data: {days: Date[], persons: Person[]} = await request.json();
    const fixedPersons = data.persons.map(p => ({...p, startFrom: p.startFrom ? new Date(p.startFrom): undefined}));
    const fixedDays = data.days.map(d => new Date(d));
    const [matches, times] = match(fixedPersons, fixedDays);

    return json({matches, times}, {status: 200});
}

function match(persons: Person[], days: Date[]): [Match[], Times[]] {
    const matches = matchDays(days, persons);

    const map = matches.map(m => m.person).reduce((acc: Map<Person, number>, val: Person) => {
        acc.set(val, (acc.get(val) || 0) + 1);
        return acc;
    }, new Map<Person, number>());
    const times: Times[] = Array.from(map, ([person, amount]) => ({person, amount}));

    return [matches, times];
}

function matchDays(allDates: Date[], persons: Person[]): Match[] {
    if (allDates.length === 0) {
        return [];
    }

    const [dates, remainingDates] = splitArray(allDates, persons.length);

    shuffleArray(persons);
    let matchedDates: Match[] = [];
    for (const person of persons) {
        if (dates.length === 0 ) {
            break;
        }
        if (person.preference.length === 0 && isAllowedOnDay(person, dates[0])) {
            const date = dates.shift();
            if (date) matchedDates.push({date, person, happy: true});
        } else {
            const preferredDate = findPreferredDate(person, dates);
            if (preferredDate) {
                matchedDates.push({date: preferredDate, person, happy: true});
            } else {
                const firstAvailableIndex = dates.findIndex(d => isAllowedOnDay(person, d));
                if (firstAvailableIndex > -1) {
                    const date = dates.splice(firstAvailableIndex, 1)[0];
                    if (date) matchedDates.push({date, person, happy: false});
                }
            }
        }
    }
    matchedDates = tradeDays(matchedDates);

    if (dates.length > 0) {
        console.log('There were dates left, someone must not be allowed to start yet')
    }

    if (remainingDates.length > 0 || dates.length > 0) {
        return [...matchedDates, ...matchDays([...dates, ...remainingDates], persons)];
    }
    return matchedDates;
}

function findPreferredDate(person: Person, dates: Date[]) {
    for (let i = 0; i < dates.length; i++) {
        if (hasPreference(person, dates[i]) && isAllowedOnDay(person, dates[i])) {
            return dates.splice(i, 1)[0];
        }
    }
    return undefined;
}

function tradeDays(matched: Match[]): Match[] {
    const fixedMatched = [...matched];
    for (let i = 0; i < fixedMatched.length; i++) {
        const {date, person, happy}: Match = fixedMatched[i];
        if (!happy) {
            for (let j = 0; j < fixedMatched.length; j++) {
                const {date: day2, person: person2, happy: p2Happy} = fixedMatched[j];
                const happyOnOtherDay = hasPreference(person2, date);
                if (hasPreference(person, day2)
                        && person.name !== person2.name
                        && isAllowedOnDay(person, day2)
                        && isAllowedOnDay(person2, date)
                        && (happyOnOtherDay || !p2Happy)) {
                    fixedMatched[i] = {date, person: person2, happy: happyOnOtherDay};
                    fixedMatched[j] = {date: day2, person, happy: true};
                    if (!happyOnOtherDay) {
                        i--; // Reset i to try to find a day for the person that is now not happy.
                    }
                    break;
                }
            }
        }
    }
    return fixedMatched;
}

function hasPreference(person: Person, day: Date): boolean {
    return person.preference.length === 0 || person.preference.includes(day.getDay());
}

function isAllowedOnDay(person: Person, day: Date) {
    return !person.startFrom || day >= person.startFrom;
}

function splitArray(allDates: Date[], desiredLength: number): [Date[], Date[]] {
    const length = Math.min(allDates.length, desiredLength);
    const split = allDates.splice(0, length);

    return [split, allDates];
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
