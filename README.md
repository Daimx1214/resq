# LifeTag

**In case of accident, scan me.**

LifeTag is a QR emergency tag for a motorcycle helmet or vehicle. If the rider is hurt and cannot speak, any bystander can scan the sticker to see the rider's blood group and reach their family in one tap.

Built for **SafeSpace Hacks 2026** (Devpost), solo, by Daim Ali.

## The problem

In Pakistan, motorcycle accidents are an everyday event, and the first problem is rarely treatment. It is identity. An unconscious rider has no voice: nobody knows his blood group, his allergies, or who to call. Phones are locked. Wallets are missing. The golden hour is spent finding a name.

## What LifeTag does

- A rider creates a 2-minute emergency profile: first name, blood group, allergies, conditions, and up to two family contacts. No CNIC, no home address, nothing else is ever asked.
- The rider prints a sticker for the helmet or vehicle. The QR carries only the scan link plus, as plain text, the rider's first name and blood group, so the two most vital facts still work with no internet and no server.
- A bystander who scans it first meets an **emergency gate**: "Is this a real emergency?" The family is told about every emergency scan, and misuse is logged.
- Behind the gate: blood group (labelled self-reported, always test before transfusion), allergies, conditions, medicines, one-tap **Call 1122** and **Call family** buttons, and spoken instructions in Urdu for bystanders who cannot read.
- Family phone numbers are **never printed and never displayed as text**. A contact becomes reachable only after that contact personally agrees to be listed.
- Owners can set **today's rider** (borrowed bikes are normal), deactivate a lost tag in one tap, regenerate a code, see every scan, and download all of their data.

## Safety of the design itself

Before building, we attacked the idea and wrote down 40 ways it could fail or be misused: sticker photographs used for accident scams, prank scans panicking families, wrong self-reported blood groups, sequential tag numbers being scraped, borrowed bikes, stolen helmets, bystanders who fear police involvement, and more. The design answers each one it can, and states plainly what it cannot fix. The app's About page carries the full list ("How LifeTag works, honestly").

Key answers, in short:

- No phone number in the QR, on the sticker, or on the scan screen. Ever.
- Tag codes are random 12-character strings. Nothing sequential exists to scrape.
- Empty medical fields display as "Not provided. Treat as unknown", never as "none".
- Repeated non-emergency scans lock the tag down to blood group and 1122 only.
- First-aid guidance is deliberately minimal and conservative: call 1122, do not move the person, do not remove the helmet.

## Honest limitations of this prototype

- Profiles are stored on the owner's device in this build (localStorage), so a scan resolves where the tag data is available. The production design moves tag records to a small server under the same privacy rules; the data layer in `js/store.js` is written behind an interface for exactly that swap.
- Alerts in this build are the scan log in the owner's dashboard plus the bystander's call buttons. SMS alerts need a paid gateway and are a roadmap item, not a claim.
- LifeTag is a prototype. It is not a replacement for emergency services, and it says so on every screen.

## Tech

Plain HTML, CSS and JavaScript. No framework, no build step, no external requests: the QR library (`js/qrcode.js`, MIT, by Kazuhiko Arase) is vendored, and everything else is hand-written. Works offline after the first load (service worker, network-first).

## Credits

Designed and built by Daim Ali for SafeSpace Hacks 2026, with AI assistance from Claude (Muse), credited here as the event rules require. All demo data in screenshots and tests is synthetic.

## License

MIT
