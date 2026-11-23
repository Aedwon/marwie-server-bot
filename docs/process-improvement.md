# Process improvement

Rules and required steps that came from failures. At most 12 entries in total. Merge or retire before adding.

## Required steps

1. Before a website change is deployed, capture every route at 1440x900, 1024x800 and 390x844 in light and dark, and open every capture. A script check that passes does not replace looking. Run the element overlap probe (any two visible content boxes in `main` that intersect without one containing the other) on every capture and fix every hit before deploy.

## Log

### 2026-11-23 Control redesign deployed with an overlapping page

- Owner's words: "did you actually thoroughly check? why didn't you just put the search bar on the left sidebar and also the dropdown and sidebar toggle? and even my profile pic and its functions underneath? so disappointing"
- What was wrong: on Notification roles at desktop width, the Discord preview covered the right edge of the Panel title and Panel description fields. Button rows repeated their label ("Live Notifications  Live Notifications"). The top bar split server, search and account away from the sidebar and left a wide empty strip.
- Why it got through: the lead reviewed a sample of pages by eye and trusted a script that only detected content past the right edge of the viewport. It did not detect two elements overlapping. Notification roles was never opened at desktop width before deploy.
- Fix: required step 1 above, and the overlap probe added to the acceptance script.
