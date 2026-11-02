/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import React from 'react'

import { importMap } from './admin/importMap.js'
import './custom.css'

// The admin uses the website's fonts, self-hosted; custom.css reads them through these variables.
const sans = Inter({ subsets: ['latin'], display: 'swap' })
const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500'], style: ['normal', 'italic'], display: 'swap' })
const fontVars = `:root{--gg-font-sans:${sans.style.fontFamily};--gg-font-serif:${serif.style.fontFamily}}`

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

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    <style href="gg-admin-fonts" precedence="default">
      {fontVars}
    </style>
    {children}
  </RootLayout>
)

export default Layout
