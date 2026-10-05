# kamee_fitness.webapp

## Download links

Use `https://kamee.fit/download` for ads and shared download links. The public
route sends Android visitors to Google Play and iPhone/iPad visitors to the
App Store. Desktop visitors go to the homepage. Desktop-mode iPad Safari uses
a small browser touch check; manual store links remain available if that
navigation is blocked.

Campaign `utm_*` parameters are carried through the existing store URL helper.
Responses are not cached, so one visitor's device cannot select another
visitor's store. This link routes visitors; it does not enable Meta install
measurement or change an ad's optimization goal.

Run `npm test` and `npm run build` from the nested `kamee-fitness.webapp/` app.
Netlify uses `npm run build -- --webpack` to avoid its Turbopack font-resolver
failure; the fonts and Next.js runtime remain unchanged.
