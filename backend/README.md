# Weekend counselling booking

GitHub Pages links to a Google Apps Script web app. The web app lists available times, stores confirmed bookings in a private Google Sheet, and queues two alerts for the academy. Students receive their booking reference on-screen. The academy sends the Google Meet invitation manually.

Every Saturday and Sunday has eight 40-minute slots in India Standard Time. The morning starts are 11:00, 11:40, 12:20 and 13:00. The afternoon starts are 16:00, 16:40, 17:20 and 18:00. The final 20 minutes of each window remain free because a 40-minute session cannot fit. The page shows the next 56 calendar days and refreshes when a selected slot is taken.

## Set up the private booking sheet

1. Create a Google Sheet under the academy's account. Keep its sharing setting **Restricted** and share it only with staff who handle counselling.
2. Open **Extensions → Apps Script**. Replace the default script with `Code.gs`. Add an HTML file named **Booking**, then paste `Booking.html`.
3. In **Project Settings → Script Properties**, set the values below. Enter the Meta credentials here and keep them out of GitHub, browser files and student communications.
4. Save, reload the sheet, then choose **Counselling → Set up booking and notifications**. Authorize the requested Google services when prompted. The menu creates the **Bookings** tab and installs the five-minute alert trigger for the current account. Have only the designated deployment owner run setup.
5. In the Apps Script editor, choose **Deploy → New deployment → Web app**. Set **Execute as** to **Me**, and set access to **Anyone** so students can book without signing into the academy's account. If the Workspace policy omits anonymous access, a Workspace administrator must enable it or the deployment must use an authorized account that supports it.
6. Copy the published URL ending in `/exec` into the dashboard booking configuration. Open it in a private browser window and submit a test reservation with a test email. Check the sheet and both notifications before opening public bookings. When updating script files, update the active deployment to a new version so its existing URL continues to work.

## Script properties

| Property | Value |
| --- | --- |
| `OWNER_EMAIL` | Academy email address for new-booking alerts |
| `WA_TOKEN` | Meta access token authorized for sending WhatsApp messages |
| `WA_PHONE_ID` | Meta WhatsApp Business sender's phone number ID |
| `WA_OWNER_NUMBER` | WhatsApp recipient number with country code, digits only |
| `WA_API_VERSION` | Supported Graph API version selected in Meta |
| `WA_TEMPLATE` | Approved template name |
| `WA_LANGUAGE` | Approved template's language code |

In WhatsApp Manager, create an appropriate template with two **positional** variables in the body, in this order: booking reference and time. Example body: “New counselling booking {{1}} for {{2}}. Open the academy's private booking sheet for details.” Use an opted-in recipient number that can receive from the configured sender. During testing, complete Meta's test-recipient setup if using a test phone number. Match the approved template's language and positional variables exactly.

## Handle a booking

1. Open the booking row using the reference and check the time and student's email.
2. Create a 40-minute Google Calendar event in **Asia/Kolkata**, add Google Meet and invite the student using that email. Save the Meet URL in the private **Google Meet** column if you want to track it there.
3. To release a reservation, set its **Booking status** to `CANCELLED`. Handle any related Calendar event and student communication separately.

Alert columns report `PENDING`, `SENDING`, `ACCEPTED`, `CONFIGURE` or `REVIEW`. `ACCEPTED` means the provider accepted the send request. Check actual delivery with the test reservation. The five-minute trigger retries transient failures. After correcting configuration, set the relevant state to `PENDING` and its attempts and lease cells to `0`, then use **Counselling → Process pending alerts**. A send can be repeated if a provider accepts it and the acknowledgement is lost. The booking reference identifies duplicate alerts for the same reservation. Use a filter view when reviewing live bookings and keep the column order intact.

The public page returns availability and the requesting student's new confirmation only. Names and emails stay in the private sheet and the email and WhatsApp alerts carry the reference and time. Publish the academy's booking privacy notice and apply its retention practice to the sheet.

## References

- [Google Apps Script web app deployment](https://developers.google.com/apps-script/guides/web)
- [Apps Script client-to-server calls](https://developers.google.com/apps-script/guides/html/communication)
- [Meta WhatsApp Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/)

## Local verification

From the repository root, run `node --test backend/booking.test.cjs`. The test suite uses in-memory mocks and sends no messages.
