# Google Release Radar Design

## Goal

Build a GitHub Pages-ready static site that tracks public Google ecosystem release sources and can refresh itself through scheduled GitHub Actions.

## Architecture

The site has no runtime backend. A Node script fetches official JSON, XML, Atom, and HTML sources during build time and writes `public/data/google-releases.json`. The browser app reads that JSON and renders operational release tables, source health, feed entries, and Pixel page fingerprints.

## Data Handling

Chrome and ChromeOS use structured Google endpoints. Android SDK uses Google's repository XML. Android Security Bulletin is parsed from the AOSP overview page. Pixel OTA and Factory Images pages are treated as monitored official pages with title, last-updated metadata, byte size, and a content hash because their served HTML does not reliably expose a structured firmware list.

## Interface

The UI is a dense technical radar, not a marketing landing page. The first viewport shows the latest generation timestamp, source health count, latest Chrome stable version, ChromeOS board count, and latest Android security patch level. Below that are tables for Chrome, ChromeOS, Android security bulletins, SDK packages, plus a right rail for source health and RSS entries.

## Deployment

GitHub Actions runs on push, manual dispatch, and a six-hour cron. The workflow installs Node dependencies, runs the data fetch, builds the Vite static bundle, and deploys `dist` to GitHub Pages.
