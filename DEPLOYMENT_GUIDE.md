# DMT FOH Shift Guide
## GitHub Pages Deployment Guide

This guide assumes you have never used GitHub before.

## What You Are Publishing

Upload the contents of this folder to GitHub Pages:

```text
pow-accessibility-pwa/
```

The public app will be available at a URL like:

```text
https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY-NAME/
```

## Before You Start

Use the release folder exactly as supplied. The file `index.html` must be at the top level of the published GitHub repository.

Do not upload only the zip file. Unzip it first, then upload the files and folders inside `pow-accessibility-pwa`.

## 1. Create A GitHub Account

Skip this section if you already have a GitHub account.

1. Go to `https://github.com`.
2. Click **Sign up**.
3. Enter your email address.
4. Create a password.
5. Choose a username.
6. Complete the verification steps.
7. Confirm your email address if GitHub asks you to.
8. Sign in to GitHub.

## 2. Create The Repository

1. In GitHub, click the **+** button near the top right.
2. Click **New repository**.
3. In **Repository name**, enter:

```text
pow-accessibility-assistant
```

4. Set the repository to **Public**.
5. Tick **Add a README file**.
6. Click **Create repository**.

## 3. Upload The App Files

1. Open the new repository on GitHub.
2. Click **Add file**.
3. Click **Upload files**.
4. On your computer, open the folder:

```text
pow-accessibility-pwa
```

5. Select all files and folders inside it.
6. Drag them into the GitHub upload area.
7. Wait for the upload to finish.
8. In **Commit message**, type:

```text
Add DMT FOH Shift Guide
```

9. Click **Commit changes**.

Check the repository file list. You should see `index.html`, `style.css`, `app.js`, `manifest.json`, `service-worker.js`, `version.js`, `data`, `assets`, and `icons`.

If you do not see `.nojekyll`:

1. Click **Add file**.
2. Click **Create new file**.
3. In the filename box, type:

```text
.nojekyll
```

4. Leave the file contents blank, or type:

```text
GitHub Pages static site
```

5. Click **Commit changes**.

## 4. Enable GitHub Pages

1. Open the repository on GitHub.
2. Click **Settings**.
3. In the left sidebar, click **Pages**.
4. Under **Build and deployment**, find **Source**.
5. Choose **Deploy from a branch**.
6. Under **Branch**, choose **main**.
7. Under the folder dropdown, choose **/(root)**.
8. Click **Save**.

GitHub may take a few minutes to publish the site.

## 5. Get The Public URL

1. Stay on **Settings > Pages**.
2. Wait until GitHub shows the site URL.
3. Click **Visit site**.
4. Copy the URL from your browser address bar.

It should look like:

```text
https://YOUR-GITHUB-USERNAME.github.io/pow-accessibility-assistant/
```

This is the URL to share with staff.

## 6. Test The Application

### Desktop Test

1. Open the GitHub Pages URL.
2. Confirm the app loads.
3. Confirm the first screen says **Theatre**.
4. Continue to **About Me**.
5. Confirm the default working profile is **Standard Duties**.
6. Confirm the track overview cards appear.
7. Choose a track.
8. Continue to **Supporting Another Colleague?**.
9. Choose **No** and press **Start Shift**.
10. Confirm **My Shift Tonight** appears.
11. Open **Quick Reference**.
12. Go back and test **Yes** with a supported track and mobility.
13. Confirm the version number is `3.0.0`.

### iPhone Install Test

1. Open the GitHub Pages URL in **Safari** on iPhone.
2. Confirm the install guide appears.
3. Tap the **Share** button.
4. Scroll if needed.
5. Tap **Add to Home Screen**.
6. Tap **Add**.
7. Open the app from the Home Screen.
8. Confirm the install guide no longer appears.
9. Confirm the app still opens to the guided workflow.

### Android Install Test

1. Open the GitHub Pages URL in Chrome on Android.
2. Confirm the install guide appears.
3. If Chrome shows **Install App**, tap it.
4. If Chrome does not show **Install App**, open the browser menu.
5. Tap **Add to Home Screen** or **Install App**.
6. Confirm the installation.
7. Open the app from the phone launcher.
8. Confirm the install guide no longer appears.
9. Confirm the app still opens to the guided workflow.

## 7. Test Offline Mode

Do this after installing the app on a phone.

1. Open the installed app once while online.
2. Wait for the app to finish loading.
3. Turn off WiFi.
4. Turn off mobile data.
5. Close the app.
6. Reopen the app from the Home Screen.
7. Confirm the Theatre screen loads.
8. Continue through the setup screens.
9. Confirm My Shift Tonight opens.

## 8. Publish Future Updates

For each future release:

1. Update the application files.
2. Open `version.js`.
3. Increase the version number, for example:

```js
globalThis.POW_APP_VERSION = "3.0.1";
```

4. If the master data changes, replace `data/master-data.js` and `data/master-data.json`.
5. Upload the changed files to GitHub.
6. Commit the changes.
7. Wait for GitHub Pages to publish.

When installed users next open the app while online, the app checks for a newer service worker. If a new version is available, it shows:

```text
A new version is available.
```

The user can tap **Update**.

## 9. Test Update Detection

Use this test after the first version has already been installed on a phone.

1. Open `version.js`.
2. Increase the version number by one patch number.
3. Upload the changed `version.js` to GitHub.
4. Also upload `service-worker.js` if you changed any cache list entries.
5. Wait for GitHub Pages to publish.
6. Open the installed app while online.
7. Wait a few seconds.
8. Confirm the message appears:

```text
A new version is available.
```

9. Tap **Update**.
10. Confirm the app reloads.
11. Confirm the new version number appears in the footer.

## 10. QR Code

Do not create the QR code until you know the final GitHub Pages URL.

When the URL is known:

1. Copy the GitHub Pages URL.
2. Use a free QR code generator.
3. Paste the URL.
4. Generate the QR code.
5. Download the QR code image.
6. Test the QR code with an iPhone camera.
7. Test the QR code with an Android camera.
8. Confirm both open the GitHub Pages URL.

Free options include:

- A browser built-in QR feature, if available.
- Any free QR website that does not require payment or account creation.

If the GitHub Pages URL changes, regenerate the QR code using the new URL.

## References

- GitHub Pages site creation: `https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site`
- GitHub Pages publishing source: `https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site`
- GitHub web file upload: `https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository`
