/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { Inter } from 'next/font/google'
import { connection } from 'next/server'
import React from 'react'

import { importMap } from './admin/importMap.js'
import './custom.css'

// The admin uses the website's sans, self-hosted; custom.css reads it through this variable.
const sans = Inter({ subsets: ['latin'], display: 'swap' })
const fontVars = `:root{--gg-font-sans:${sans.style.fontFamily}}`

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

// The admin is per user and Payload's RootLayout reads the clock, so it renders at request time (Cache Components
// would otherwise try to prerender it and report "new Date() while prerendering").
export const instant = false

const Layout = async ({ children }: Args) => {
  await connection()
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      <style href="gg-admin-fonts" precedence="default">
        {fontVars}
      </style>
      {children}
    </RootLayout>
  )
}

export default Layout
