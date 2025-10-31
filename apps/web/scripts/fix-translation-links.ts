#!/usr/bin/env bun

import { createAdminClient } from '../src/lib/appwrite'
import { Query } from '@repo/api'

async function fixTranslationLinks() {
  try {
    const { db } = await createAdminClient()
    
    console.log('🔧 Fixing translation relationships...')
    
    // Get all jobs
    const jobsResponse = await db.listRows('app', 'jobs')
    console.log(`Found ${jobsResponse.rows.length} jobs`)
    
    // Get all translations
    const translationsResponse = await db.listRows('app', 'content_translations')
    console.log(`Found ${translationsResponse.rows.length} translations`)
    
    // For each translation, update it to have the proper job_ref relationship
    for (const translation of translationsResponse.rows) {
      console.log(`Updating translation ${translation.$id} for job ${translation.content_id}`)
      
      try {
        await db.updateDocument('app', 'content_translations', translation.$id, {
          job_ref: translation.content_id
        })
        console.log(`✅ Updated translation ${translation.locale} for job ${translation.content_id}`)
      } catch (error) {
        console.error(`❌ Failed to update translation ${translation.$id}:`, error)
      }
    }
    
    console.log('\n🔍 Verifying relationships...')
    
    // Check if relationships are now working
    const updatedJobsResponse = await db.listRows('app', 'jobs')
    
    for (const job of updatedJobsResponse.rows) {
      console.log(`\nJob ${job.$id}:`)
      console.log(`  translation_refs: ${job.translation_refs ? job.translation_refs.length : 0} items`)
      
      if (job.translation_refs && job.translation_refs.length > 0) {
        job.translation_refs.forEach((ref: any) => {
          console.log(`    - ${ref.locale}: "${ref.title}"`)
        })
      }
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error)
  }
}

fixTranslationLinks()
