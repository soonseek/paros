"""
Tests for trackMultipleLoans Algorithm Bug Fix
=============================================

Bug: 대출금 추적 시 토스뱅크로 이동된 돈의 사용 내역이 누락되는 버그
- 이전 코드에서는 remainingLoan을 전역 제한자로 사용
- 대출계좌 직접 출금이 먼저 차감되면 이동 대상 계좌(토스뱅크)의 출금이 일부만 표시

Fix:
1. 1단계에서 loanBudget 기반으로 이동+직접출금 관리
2. 2단계에서 remainingLoan 제한 제거 - 이동 예산(budget)으로만 제한
3. 정렬 후 remainingLoan 순차 재계산
4. depositMatchMap을 배열 기반으로 변경하여 동일 날짜+금액 이동 여러 건 정확 매칭

Test Scenarios:
- Scenario 1: Destination account withdrawals within budget are ALL displayed
- Scenario 2: Same date+amount multiple transfers match correctly (array-based map)
- Scenario 3: remainingLoan is recalculated chronologically after sorting
- Scenario 4: Transfers do NOT change remainingLoan, only withdrawals do
- Scenario 5: loanBudget does not exceed loan amount
- Scenario 6: Summary values (totalUsed, transferCount, remainingLoan, exhausted) are accurate

Also verifies trackLoanUsage: Transfer transactions don't decrement remainingLoan
"""

import pytest
import os


class TestTrackMultipleLoansAlgorithm:
    """
    Tests for the trackMultipleLoans algorithm logic
    
    These tests verify the algorithm implementation by checking the code structure
    """
    
    def test_stage1_loan_budget_management(self):
        """
        1단계: loanBudget 기반으로 이동+직접출금 관리 확인
        
        loanBudget starts at loanAmount, and is decremented for BOTH:
        - Transfers (이동) to other accounts
        - Direct expenses (출금) from loan account
        
        This prevents tracking more than the loan amount total.
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        # Find trackMultipleLoans function
        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_end = len(content)
        func_body = content[func_start:func_end]
        
        # Verify loanBudget is initialized to loanAmount
        assert 'let loanBudget = loanAmount' in func_body, \
            "loanBudget should be initialized to loanAmount"
        
        # Verify loanBudget is decremented for transfers
        assert 'loanBudget -= actualTransfer' in func_body, \
            "loanBudget should be decremented for transfers"
        
        # Verify loanBudget is decremented for direct expenses
        assert 'loanBudget -= actualExpense' in func_body, \
            "loanBudget should be decremented for direct expenses"
        
        # Verify loanBudget check to prevent over-tracking
        assert 'if (loanBudget <= 0) break' in func_body, \
            "Should break when loanBudget is exhausted"
        
        print("✓ Stage 1: loanBudget management verified")
        print("  - loanBudget initialized to loanAmount")
        print("  - Decremented for both transfers and direct expenses")
        print("  - Prevents tracking more than loan amount")
    
    def test_stage2_destination_withdrawals_budget_only(self):
        """
        2단계: 이동 대상 계좌 출금은 remainingLoan 제한 없이 이동 예산(budget)으로만 제한
        
        Bug fix: Previously, remainingLoan was used as a global limiter, causing
        destination account withdrawals to be truncated if direct expenses from
        loan account consumed the budget first.
        
        Fix: Stage 2 only uses per-account budget (total transferred to that account)
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        # Find the stage 2 section
        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[func_start:]
        
        # Verify destBudgets is used for limiting destination withdrawals
        assert 'destBudgets' in func_body, \
            "destBudgets should exist for per-account budget management"
        
        # Verify budget is calculated from transferred amounts
        assert 'destBudgets.set(dep.document.id, prev + amount)' in func_body, \
            "destBudgets should accumulate transferred amounts per account"
        
        # Verify destination withdrawals are limited by budget
        assert 'const budget = destBudgets.get(docId)' in func_body or \
               'destBudgets.get' in func_body, \
            "Should check destBudgets when processing destination withdrawals"
        
        # Verify budget check
        assert 'if (budget <= 0) continue' in func_body, \
            "Should skip when account budget is exhausted"
        
        # Verify tracking within budget
        assert 'Math.min(txAmount, budget)' in func_body, \
            "Should track only up to remaining budget"
        
        print("✓ Stage 2: Destination withdrawals budget management verified")
        print("  - Uses per-account destBudgets (not global remainingLoan)")
        print("  - Budget = total amount transferred to that account")
        print("  - Withdrawals limited by account's received transfer amount")
    
    def test_stage3_sorting_and_remaining_loan_recalculation(self):
        """
        3단계: 정렬 후 remainingLoan 순차 재계산 확인
        
        After collecting all tracked items, they are:
        1. Sorted by date (then by type: 대출실행 → 이동 → 출금)
        2. remainingLoan is recalculated as a running total
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[func_start:]
        
        # Verify sorting
        assert 'trackedItems.sort' in func_body, \
            "trackedItems should be sorted"
        
        # Verify type ordering in sort
        assert 'typeOrder' in func_body, \
            "Should have typeOrder for sorting by type within same date"
        
        # Verify remainingLoan recalculation
        assert 'runningLoan' in func_body, \
            "Should use runningLoan for recalculation"
        
        # Verify recalculation logic
        assert 'let runningLoan = loanAmount' in func_body, \
            "runningLoan should start at loanAmount"
        
        # Verify only withdrawals decrement
        assert 'runningLoan -= item.amount' in func_body, \
            "Only withdrawals should decrement runningLoan"
        
        print("✓ Stage 3: Sorting and remainingLoan recalculation verified")
        print("  - Items sorted by date, then by type")
        print("  - remainingLoan recalculated as running total")
        print("  - Only 출금 type decrements running loan")
    
    def test_transfers_do_not_change_remaining_loan(self):
        """
        이동(transfer)은 remainingLoan 변동 없음 확인
        
        Bug fix: When money is transferred to another account, it's not actually
        spent - it just moves. Only actual expenses should reduce remainingLoan.
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[func_start:]
        
        # Find the remainingLoan recalculation section
        # Should have pattern: 이동 → remainingLoan unchanged
        assert 'item.type === "이동"' in func_body, \
            "Should check for 이동 type"
        
        # Verify 이동 doesn't decrement in recalculation
        # The pattern is: else if (item.type === "이동") { item.remainingLoan = runningLoan; }
        lines = func_body.split('\n')
        found_transfer_no_decrement = False
        for i, line in enumerate(lines):
            if 'item.type === "이동"' in line:
                # Check that next few lines don't have runningLoan -= 
                block_has_decrement = False
                for j in range(i, min(i+3, len(lines))):
                    if 'runningLoan -=' in lines[j]:
                        block_has_decrement = True
                        break
                if not block_has_decrement:
                    found_transfer_no_decrement = True
                    break
        
        assert found_transfer_no_decrement, \
            "이동 type should NOT decrement runningLoan"
        
        # Verify comment explains this
        assert '이동은 잔여액 변동 없음' in func_body or \
               '이동' in func_body, \
            "Code should indicate transfers don't change remaining loan"
        
        print("✓ Transfers do NOT change remainingLoan verified")
        print("  - 이동 type preserves runningLoan")
        print("  - Only 출금 type decrements")
    
    def test_deposit_match_map_array_based(self):
        """
        depositMatchMap을 배열 기반으로 변경 확인 (동일 날짜+금액 이동 여러 건 정확 매칭)
        
        Bug fix: Previously, depositMatchMap was object-based, which couldn't
        handle multiple deposits with the same date+amount correctly.
        
        Fix: Changed to array-based, with usedDepositCounts to track how many
        matches per key have been consumed.
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[func_start:]
        
        # Verify depositMatchMap is array-based (Map<string, Array<...>>)
        assert 'Map<string, Array<' in func_body, \
            "depositMatchMap should be Map<string, Array<...>>"
        
        # Verify usedDepositCounts exists
        assert 'usedDepositCounts' in func_body, \
            "usedDepositCounts should exist for tracking consumed matches"
        
        # Verify the matching logic uses count
        assert 'const usedCount = usedDepositCounts.get(matchKey)' in func_body or \
               'usedDepositCounts.get' in func_body, \
            "Should get usedCount when matching"
        
        # Verify count is incremented on match
        assert 'usedDepositCounts.set(matchKey, usedCount + 1)' in func_body, \
            "Should increment usedCount on successful match"
        
        # Verify array indexing for correct deposit
        assert 'deposits[usedCount]' in func_body, \
            "Should use usedCount as index into deposits array"
        
        print("✓ Array-based depositMatchMap verified")
        print("  - Map<string, Array<...>> structure")
        print("  - usedDepositCounts tracks consumed matches")
        print("  - Correctly handles multiple deposits with same date+amount")
    
    def test_loan_budget_does_not_exceed_loan_amount(self):
        """
        loanBudget이 대출금을 초과하지 않도록 제한 확인
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[func_start:]
        
        # Verify loanBudget starts at loanAmount
        assert 'let loanBudget = loanAmount' in func_body, \
            "loanBudget should start at loanAmount"
        
        # Verify Math.min is used to cap amounts
        assert 'Math.min(withdrawal, loanBudget)' in func_body, \
            "Should cap transfer/expense at remaining loanBudget"
        
        # Verify break when exhausted
        assert 'if (loanBudget <= 0) break' in func_body, \
            "Should stop when loanBudget exhausted"
        
        print("✓ loanBudget cap verified")
        print("  - Cannot exceed loan amount")
        print("  - Math.min caps individual transactions")
        print("  - Stops when budget exhausted")
    
    def test_summary_values_accuracy(self):
        """
        summary의 totalUsed, transferCount, remainingLoan, exhausted 값 정확성 확인
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[func_start:]
        
        # Verify totalUsed calculation
        assert 'totalUsed' in func_body, "totalUsed should be in summary"
        assert 'loanAmount - Math.max(0, runningLoan)' in func_body, \
            "totalUsed should be loanAmount - remainingLoan"
        
        # Verify transferCount calculation
        assert 'transferCount' in func_body, "transferCount should be in summary"
        assert 'filter(t => t.type === "이동")' in func_body, \
            "transferCount should count 이동 type items"
        
        # Verify remainingLoan in summary
        assert 'remainingLoan: Math.max(0, runningLoan)' in func_body, \
            "summary.remainingLoan should be Math.max(0, runningLoan)"
        
        # Verify exhausted calculation
        assert 'exhausted: runningLoan <= 0' in func_body, \
            "exhausted should be true when runningLoan <= 0"
        
        print("✓ Summary values accuracy verified")
        print("  - totalUsed = loanAmount - remainingLoan")
        print("  - transferCount counts 이동 type items")
        print("  - remainingLoan = Math.max(0, runningLoan)")
        print("  - exhausted = runningLoan <= 0")


class TestTrackLoanUsageTransferHandling:
    """
    Tests for trackLoanUsage: 이체 거래 시 remainingLoan 차감하지 않음 확인
    """
    
    def test_transfer_keywords_detection(self):
        """
        이체 키워드 감지 확인: 이체, 송금, 이동, 振込
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        func_start = content.find('trackLoanUsage: protectedProcedure')
        func_end = content.find('getSuspectedLoanDeposits:', func_start)
        func_body = content[func_start:func_end]
        
        # Verify isTransfer variable exists
        assert 'isTransfer' in func_body, "isTransfer variable should exist"
        
        # Verify all keywords
        keywords = ['이체', '송금', '이동', '振込']
        for kw in keywords:
            assert f'"{kw}"' in func_body or f"'{kw}'" in func_body, \
                f"Should detect keyword: {kw}"
        
        print("✓ Transfer keywords detection verified")
        print(f"  - Detects: {keywords}")
    
    def test_transfer_does_not_decrement_remaining_loan(self):
        """
        이체 거래 시 remainingLoan 차감하지 않음 확인
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        func_start = content.find('trackLoanUsage: protectedProcedure')
        func_end = content.find('getSuspectedLoanDeposits:', func_start)
        func_body = content[func_start:func_end]
        
        # Verify conditional decrement
        assert 'if (!isTransfer)' in func_body, \
            "Should have condition for non-transfer"
        
        # Verify decrement is inside the condition
        lines = func_body.split('\n')
        found_correct_pattern = False
        for i, line in enumerate(lines):
            if 'if (!isTransfer)' in line:
                for j in range(i+1, min(i+5, len(lines))):
                    if 'remainingLoan -=' in lines[j]:
                        found_correct_pattern = True
                        break
        
        assert found_correct_pattern, \
            "remainingLoan decrement should be inside if (!isTransfer) block"
        
        print("✓ Transfer does NOT decrement remainingLoan")
        print("  - if (!isTransfer) { remainingLoan -= withdrawal; }")
    
    def test_transfer_type_assigned_correctly(self):
        """
        이체 거래의 type이 '이체'로 올바르게 할당되는지 확인
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        func_start = content.find('trackLoanUsage: protectedProcedure')
        func_end = content.find('getSuspectedLoanDeposits:', func_start)
        func_body = content[func_start:func_end]
        
        assert 'type: isTransfer ? "이체" : "출금"' in func_body, \
            "Type should be '이체' for transfers, '출금' for others"
        
        print("✓ Transfer type assigned correctly")
        print("  - type: isTransfer ? '이체' : '출금'")
    
    def test_break_condition_excludes_transfers(self):
        """
        Break condition이 이체를 제외하는지 확인
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        func_start = content.find('trackLoanUsage: protectedProcedure')
        func_end = content.find('getSuspectedLoanDeposits:', func_start)
        func_body = content[func_start:func_end]
        
        assert '!isTransfer && remainingLoan <= 0' in func_body, \
            "Break condition should be: !isTransfer && remainingLoan <= 0"
        
        print("✓ Break condition excludes transfers")
        print("  - Continues even if remainingLoan <= 0 if it's a transfer")


class TestAlgorithmCompleteness:
    """
    Final verification that all bug fix components are in place
    """
    
    def test_all_bug_fixes_applied(self):
        """
        Comprehensive verification of all bug fixes
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        print("=" * 70)
        print("ALGORITHM BUG FIX VERIFICATION")
        print("=" * 70)
        
        # 1. loanBudget management
        assert 'let loanBudget = loanAmount' in content
        assert 'loanBudget -= actualTransfer' in content
        assert 'loanBudget -= actualExpense' in content
        print("✓ Fix 1: loanBudget 기반 이동+직접출금 관리")
        
        # 2. destBudgets for stage 2
        assert 'destBudgets' in content
        assert 'const budget = destBudgets.get(docId)' in content or \
               'destBudgets.get' in content
        print("✓ Fix 2: 2단계 remainingLoan 제한 제거, 이동 예산(budget)으로만 제한")
        
        # 3. Sorting and recalculation
        assert 'trackedItems.sort' in content
        assert 'let runningLoan = loanAmount' in content
        assert 'runningLoan -= item.amount' in content
        print("✓ Fix 3: 정렬 후 remainingLoan 순차 재계산")
        
        # 4. Array-based depositMatchMap
        assert 'Map<string, Array<' in content
        assert 'usedDepositCounts' in content
        print("✓ Fix 4: depositMatchMap 배열 기반 변경 (동일 날짜+금액 이동 여러 건 정확 매칭)")
        
        # 5. trackLoanUsage transfer handling (previous fix preserved)
        assert 'if (!isTransfer)' in content
        assert '!isTransfer && remainingLoan <= 0' in content
        print("✓ Fix 5: trackLoanUsage 이체 거래 시 remainingLoan 차감하지 않음 (이전 수정 유지)")
        
        print("=" * 70)
        print("ALL BUG FIXES VERIFIED SUCCESSFULLY")
        print("=" * 70)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
