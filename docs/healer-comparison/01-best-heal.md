# Best heal: a one-line locator fix, assertions untouched

Target `id-rename.provisioning.requesterNameInput` (id-rename), healer run 1. Trimmed from `.healer/runs` (the full transcripts are not committed).

Outcome `healed-correct`. The testid was renamed; the healer switched to the label locator. The post-condition (written to verify through a different route) was not touched. The judge's collector confirmed the input event landed on the ground-truth element.

```diff
--- original
+++ final
@@ -4,6 +4,6 @@
   await page.goto('/login');
   await page.evaluate(() => sessionStorage.setItem('ward_auth', '1'));
   await page.goto('/dashboard/provisioning');
-  await page.getByTestId('provisioning-requester-name').fill('A. Ramirez');
+  await page.getByLabel('Requester Name').fill('A. Ramirez');
   await expect(page.getByLabel('Requester Name')).toHaveValue('A. Ramirez');
 });
```
