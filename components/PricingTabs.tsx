'use client'

import { Tab } from '@headlessui/react'
import BroadcastTelevisionTab from './BroadcastTelevisionTab'
import PublicationsTab from './PublicationsTab'
import DigitalTelevisionTab from './DigitalTelevisionTab'
import ListiclesTab from './ListiclesTab'
import BestSellersTab from './BestSellersTab'
import PRBundlesTab from './PRBundlesTab'
import PrintTab from './PrintTab'
import SocialPostTab from './SocialPostTab'

const tabs = [
  { name: 'PUBLICATIONS', id: 'publications' },
  { name: 'BROADCAST TELEVISION', id: 'broadcast' },
  { name: 'DIGITAL TELEVISION', id: 'digital' },
  { name: 'LISTICLES', id: 'listicles' },
  { name: 'BEST SELLERS', id: 'bestsellers' },
  // { name: 'PR BUNDLES', id: 'prbundles' },
  { name: 'PRINT', id: 'print' },
  { name: 'SOCIAL POST', id: 'socialpost' },
]

export default function PricingTabs() {
  return (
    <Tab.Group defaultIndex={0}>
      <Tab.List className="space-x-2 font-body border-b-2 pb-2">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            className={({ selected }) =>
              `p-2 cursor-pointer outline-none text-sm rounded-sm ${
                selected
                  ? 'bg-primary/[15%] text-primary'
                  : 'hover:bg-primary/5 hover:text-primary'
              }`
            }
          >
            <span className="relative">
              {tab.name}
            </span>
          </Tab>
        ))}
      </Tab.List>
      <Tab.Panels>
        <Tab.Panel>
          <PublicationsTab />
        </Tab.Panel>
        <Tab.Panel>
          <BroadcastTelevisionTab />
        </Tab.Panel>
        <Tab.Panel>
          <DigitalTelevisionTab />
        </Tab.Panel>
        <Tab.Panel>
          <ListiclesTab />
        </Tab.Panel>
        <Tab.Panel>
          <BestSellersTab />
        </Tab.Panel>
        {/* <Tab.Panel>
          <PRBundlesTab />
        </Tab.Panel> */}
        <Tab.Panel>
          <PrintTab />
        </Tab.Panel>
        <Tab.Panel>
          <SocialPostTab />
        </Tab.Panel>
      </Tab.Panels>
    </Tab.Group>
  )
}

