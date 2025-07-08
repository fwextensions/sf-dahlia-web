# Short-Form Application – Page Display Matrix

A reference for product and domain experts. For each short-form page we describe **when the page appears to applicants (natural language)** and provide **pointers into the code** that implements or checks that logic.  File links point to the github repo: https://github.com/SFDigitalServices/sf-dahlia-web.

> Tip: use browser search (`Ctrl/Cmd-F`) to jump to a slug.

---

## prerequisites
> *Shown only for ownership (sale/DALP) listings.*  The whole *Qualify* section is removed for rentals.
### Code refs
• [`short-form/ShortFormNavigationService.js.coffee`](https://github.com/SFDigitalServices/sf-dahlia-web/blob/main/app/assets/javascripts/short-form/ShortFormNavigationService.js.coffee) – `sections()` removes section for rentals (lines ~270-290)
• Route: [`config/angularRoutes.js.coffee`](https://github.com/SFDigitalServices/sf-dahlia-web/blob/main/app/assets/javascripts/config/angularRoutes.js.coffee) – state `dahlia.short-form-application.prerequisites`

## name
> Always shown as the first page of the *You* section.
### Code refs
• Route definition (`angularRoutes.js.coffee`)
• Navigation list in `ShortFormNavigationService.sections()`

## welcome-back
> Displayed only when the applicant has an existing draft and chooses to continue it (triggered by `ShortFormNavigationService.goToDraft*`).
### Code refs
• Route `welcome-back`
• Draft-resume flow in `ShortFormApplicationController`

## contact
> Always shown.
### Code refs  – route & navigation list.

## verify-address
> Appears immediately after the *Contact* page when the entered address needs geocoding confirmation. Triggered by a geocoder mismatch in `ShortFormApplicationService.verifyPrimaryAddress`.
### Code refs
• `ShortFormApplicationController.go('verify-address')`
• Geocode logic in `AddressDataService`.

## alternate-contact-type / alternate-contact-name / alternate-contact-phone-address
> Shown only if the applicant opts to add an alternate contact (`alternateContactType != 'None'`).
### Code refs
• Controller `alternateContactType` watcher (in `ShortFormApplicationController`)
• Route states for each page.

## household-intro
> Always the first Household page.
### Code refs – route & navigation list.

## household-overview
> Shown only if at least one household member already exists; otherwise skipped.
### Code refs
• `ShortFormNavigationService.getStartOfHouseholdDetails()` selects page based on application state.

## household-members
> Required for every application; always reached.
### Code refs – route.

## household-member-form & household-member-form-edit
> Displayed when adding or editing a member from `household-members`.
### Code refs – routes plus callbacks `addHouseholdMember` in `ShortFormNavigationService.submitActions`.

## household-member-verify-address
> Shown only if the new member’s address needs geocoding confirmation.
### Code refs – route + geocode logic.

## household-public-housing
> Appears if the listing has the “Assisted Housing” preference (`hasPreference('assistedHousing')`).
### Code refs
• `ShortFormApplicationService.hasHouseholdPublicHousingQuestion()`
• Navigation decision in `ShortFormApplicationController.validateHouseholdEligibility`.

## household-monthly-rent
> Shown when applicant answered *No* to public-housing question.
### Code refs  – `checkIfPublicHousing` method in controller.

## household-reserved-units-veteran
> Shown if the listing has “Veteran” reserved units.
### Code refs
• `ListingUnitService.listingHasReservedUnitType('Veteran')`
• Logic in `ShortFormNavigationService.getNextReservedPageIfAvailable`.

## household-reserved-units-disabled
> Shown if listing has “Disabled” reserved units and after the veteran page (if any).
### Code refs  – same as above for `Reserved_types.DISABLED`.

## household-priorities
> Shown when ANY of these are true: listing is a rental, listing.Id is in `HOUSEHOLD_PRIORITIES_LISTINGS_IDS`, or listing is *Accessible-only* reserved community.
### Code refs – `ShortFormNavigationService.showHouseholdPrioritiesPage`.

## home-and-community-based-services
> Shown when the listing’s custom type is `HCBS_PRIORITY_NAME` (currently The Kelsey).
### Code refs
• `ShortFormApplicationService.listingHasHomeAndCommunityBasedServicesUnits`
• Navigation helpers `getPostHouseholdPrioritiesPage` & `getPrevPageOfIncome*`.

## income-vouchers
> Shown only for rentals.
### Code refs – `ShortFormNavigationService.showIncomeVouchersPage`.

## income
> Always appears after vouchers page (rentals) or directly (sales).
### Code refs – route & navigation.

## preferences-intro
> Always first page of Preferences section.
### Code refs – route & nav.

## assisted-housing-preference
> Shown if listing has Assisted-Housing preference **and** applicant answered *Yes* to public-housing question.
### Code refs
• Eligibility `ShortFormApplicationService.eligibleForAssistedHousing()`
• Navigation `checkForNeighborhoodOrLiveWork` & `goBackToRentBurden`.

## rent-burdened-preference (+ rent-burdened-preference-edit)
> Shown if listing has Rent-Burden preference **and** applicant spends ≥ 50 % income on rent and is **not** in public housing. Edit page appears when user revisits.
### Code refs – `ShortFormApplicationService.eligibleForRentBurden()`.

## neighborhood-preference
> Shown when listing has NRHP and at least one household member lives in the neighborhood.
### Code refs – `ShortFormApplicationService.eligibleForNRHP()`.

## adhp-preference
> Shown for listings with Anti-Displacement preference and qualifying household member.
### Code refs – `ShortFormApplicationService.eligibleForADHP()`.

## live-work-preference
> Shown for listings with Live/Work-in-SF preference where applicant lives **or** works in SF.
### Code refs – `ShortFormApplicationService.eligibleForLiveWork()`.

## right-to-return-preference
> Shown when listing has Right-to-Return preference.
### Code refs – `ShortFormApplicationService.listingHasRTRPreference()`.

## alice-griffith-verify-address
> Special page for *Alice Griffith* listings – only those listings trigger the route.
### Code refs – route guarded by `ListingIdentityService.isAliceGriffithListing`.

## preferences-programs
> Always shown after the geographic preferences (Neighborhood / Live-Work / RTR).
### Code refs – controller `checkAfterLiveWork` flow.

## veterans-preference
> Shown if `SharedService.showVeteransApplicationQuestion(listing)` returns true **and** the earlier question “Is anyone a veteran?” was answered.
### Code refs – `ShortFormApplicationController.checkAfterPreferencesPrograms`, `SharedService.showVeteransApplicationQuestion`.

## custom-preferences / custom-proof-preferences
> Shown only if the listing defines custom (proof) preferences arrays.
### Code refs – `ShortFormApplicationService.listing.customPreferences` checks in controller (`checkForCustomPreferences`).

## general-lottery-notice
> Displayed for listings that skip all other preferences and have no special lottery rules.
### Code refs – default fall-through path in `checkForCustomPreferences`.

## review-optional
> Shown for DALP listings when demographics are autofilled (skips Review Summary).
### Code refs – `ShortFormApplicationController.goToDemographicsPageUnlessAutofilled`.

## review-summary
> Always reached before submission (unless skipped by the DALP autofill path).
### Code refs – route & nav.

## review-terms
> Final sign/submit page. Always shown.
### Code refs – route.

## confirmation
> Displayed only after successful submission.
### Code refs – route `dahlia.short-form-application.confirmation`.

---

### Auxiliary / account pages
`create-account`, `sign-in`, `forgot-password`, `choose-draft`, `continue-previous-draft`, `autofill-preview`, etc. are part of account or draft flows and not driven by listing logic – they always display when user selects those actions.
