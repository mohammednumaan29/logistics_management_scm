import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  // Relative asset URLs allow both pages to work from a sub-path.
  base: './',
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        intro: resolve(process.cwd(), 'intro.html'),
        operationsAnalyst: resolve(
          process.cwd(),
          'src/operations-analyst.html',
        ),
        inventoryManager: resolve(
          process.cwd(),
          'src/inventory-manager.html',
        ),
        logisticsManager: resolve(
          process.cwd(),
          'src/logistics-manager.html',
        ),
        supplyChainManager: resolve(
          process.cwd(),
          'src/supply-chain-manager.html',
        ),
        warehouseOperator: resolve(
          process.cwd(),
          'src/warehouse-operator.html',
        ),
        procurementApprover: resolve(
          process.cwd(),
          'src/procurement-approver.html',
        ),
        administrator: resolve(
          process.cwd(),
          'src/administrator.html',
        ),
        roleSelection: resolve(
          process.cwd(),
          'src/role-selection.html',
        ),
        login: resolve(
          process.cwd(),
          'src/login.html',
        ),
      },
    },
  },
})
