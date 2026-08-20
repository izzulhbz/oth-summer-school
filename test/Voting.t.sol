// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Voting} from "../contracts/Voting.sol";

/**
 * Local tests for Voting, run on Hardhat's in-process EVM.
 *
 * These cost nothing and run in milliseconds, so every rule is verified here
 * before anything is deployed to Hedera Testnet.
 */
contract VotingTest is Test {
    Voting private voting;

    // This test contract deploys Voting, so it is the owner.
    address private constant ADMIN = address(0xAD319);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);
    address private constant MALLORY = address(0x1A110);

    function setUp() public {
        voting = new Voting("Pizza", "Pasta", "Sushi", ADMIN);
    }

    /* ---------------------------------------------------------------- */
    /* Construction                                                     */
    /* ---------------------------------------------------------------- */

    function test_ConstructorStoresTopics() public view {
        assertEq(voting.getTopic(0), "Pizza");
        assertEq(voting.getTopic(1), "Pasta");
        assertEq(voting.getTopic(2), "Sushi");
        assertEq(voting.TOPIC_COUNT(), 3);
    }

    function test_DeployerBecomesOwnerAndAdminIsSeparate() public view {
        assertEq(voting.owner(), address(this));
        assertEq(voting.admin(), ADMIN);
        assertTrue(voting.owner() != voting.admin());
    }

    function test_TalliesStartAtZero() public view {
        assertEq(voting.getVotes(0), 0);
        assertEq(voting.getVotes(1), 0);
        assertEq(voting.getVotes(2), 0);
        assertEq(voting.totalVotes(), 0);
        assertEq(voting.getBlockedCount(), 0);
    }

    function test_EmptyTopicIsRejected() public {
        vm.expectRevert(Voting.EmptyTopic.selector);
        new Voting("", "Pasta", "Sushi", ADMIN);

        vm.expectRevert(Voting.EmptyTopic.selector);
        new Voting("Pizza", "", "Sushi", ADMIN);

        vm.expectRevert(Voting.EmptyTopic.selector);
        new Voting("Pizza", "Pasta", "", ADMIN);
    }

    function test_ZeroAdminIsRejected() public {
        vm.expectRevert(Voting.ZeroAddress.selector);
        new Voting("Pizza", "Pasta", "Sushi", address(0));
    }

    /* ---------------------------------------------------------------- */
    /* Voting                                                           */
    /* ---------------------------------------------------------------- */

    function test_VoteIncrementsTheChosenTopic() public {
        vm.prank(ALICE);
        voting.vote(1);

        assertEq(voting.getVotes(0), 0);
        assertEq(voting.getVotes(1), 1);
        assertEq(voting.getVotes(2), 0);
        assertEq(voting.totalVotes(), 1);
        assertTrue(voting.hasVoted(ALICE));
    }

    function test_VotesAccumulateOnTheSameTopic() public {
        vm.prank(ALICE);
        voting.vote(0);
        vm.prank(BOB);
        voting.vote(0);

        assertEq(voting.getVotes(0), 2);
        assertEq(voting.totalVotes(), 2);
    }

    function test_VoteEmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit Voting.VoteCast(ALICE, 2);

        vm.prank(ALICE);
        voting.vote(2);
    }

    /// The headline rule from the assignment.
    function test_CannotVoteTwice() public {
        vm.prank(ALICE);
        voting.vote(0);

        vm.prank(ALICE);
        vm.expectRevert(Voting.AlreadyVoted.selector);
        voting.vote(1);

        // The first vote stands, and nothing was double counted.
        assertEq(voting.getVotes(0), 1);
        assertEq(voting.getVotes(1), 0);
        assertEq(voting.totalVotes(), 1);
    }

    function test_CannotVoteTwiceEvenForTheSameTopic() public {
        vm.prank(ALICE);
        voting.vote(0);

        vm.prank(ALICE);
        vm.expectRevert(Voting.AlreadyVoted.selector);
        voting.vote(0);
    }

    function test_InvalidTopicIsRejected() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Voting.InvalidTopic.selector, 3));
        voting.vote(3);

        // A rejected vote must not consume Alice's one chance.
        assertFalse(voting.hasVoted(ALICE));
        assertTrue(voting.canVote(ALICE));
    }

    function test_WhoAmIReportsTheCaller() public {
        vm.prank(ALICE);
        assertEq(voting.whoAmI(), ALICE);
    }

    /* ---------------------------------------------------------------- */
    /* Blocklist behaviour                                              */
    /* ---------------------------------------------------------------- */

    function test_BlockedAccountCannotVote() public {
        vm.prank(ADMIN);
        voting.blockVoter(MALLORY);

        assertTrue(voting.blocked(MALLORY));
        assertFalse(voting.canVote(MALLORY));

        vm.prank(MALLORY);
        vm.expectRevert(Voting.AccountBlocked.selector);
        voting.vote(0);

        assertEq(voting.totalVotes(), 0);
    }

    function test_UnblockingRestoresTheRightToVote() public {
        vm.startPrank(ADMIN);
        voting.blockVoter(MALLORY);
        voting.unblockVoter(MALLORY);
        vm.stopPrank();

        vm.prank(MALLORY);
        voting.vote(0);
        assertEq(voting.getVotes(0), 1);
    }

    function test_BlockingAfterVotingDoesNotEraseTheVote() public {
        vm.prank(ALICE);
        voting.vote(0);

        vm.prank(ADMIN);
        voting.blockVoter(ALICE);

        assertEq(voting.getVotes(0), 1);
        assertEq(voting.totalVotes(), 1);
    }

    /* ---------------------------------------------------------------- */
    /* Blocklist enumeration                                            */
    /* ---------------------------------------------------------------- */

    function test_BlockedListIsEnumerable() public {
        vm.startPrank(ADMIN);
        voting.blockVoter(ALICE);
        voting.blockVoter(BOB);
        voting.blockVoter(CAROL);
        vm.stopPrank();

        assertEq(voting.getBlockedCount(), 3);
        assertEq(voting.getBlockedVoter(0), ALICE);
        assertEq(voting.getBlockedVoter(1), BOB);
        assertEq(voting.getBlockedVoter(2), CAROL);

        address[] memory list = voting.getBlockedVoters();
        assertEq(list.length, 3);
        assertEq(list[0], ALICE);
        assertEq(list[2], CAROL);
    }

    /// Blocking the same account twice must not create a duplicate entry.
    function test_BlockingTwiceIsIdempotent() public {
        vm.startPrank(ADMIN);
        voting.blockVoter(ALICE);
        voting.blockVoter(ALICE);
        voting.blockVoter(ALICE);
        vm.stopPrank();

        assertEq(voting.getBlockedCount(), 1);
        assertEq(voting.getBlockedVoter(0), ALICE);
    }

    function test_UnblockingRemovesFromTheList() public {
        vm.startPrank(ADMIN);
        voting.blockVoter(ALICE);
        voting.blockVoter(BOB);
        voting.blockVoter(CAROL);

        // Remove from the middle - exercises the swap-and-pop path.
        voting.unblockVoter(BOB);
        vm.stopPrank();

        assertEq(voting.getBlockedCount(), 2);
        assertFalse(voting.blocked(BOB));

        address[] memory list = voting.getBlockedVoters();
        assertEq(list.length, 2);
        // ALICE stays in place, CAROL is swapped into BOB's slot.
        assertEq(list[0], ALICE);
        assertEq(list[1], CAROL);
    }

    function test_UnblockingEveryoneEmptiesTheList() public {
        vm.startPrank(ADMIN);
        voting.blockVoter(ALICE);
        voting.blockVoter(BOB);
        voting.unblockVoter(ALICE);
        voting.unblockVoter(BOB);
        vm.stopPrank();

        assertEq(voting.getBlockedCount(), 0);
        assertEq(voting.getBlockedVoters().length, 0);
    }

    function test_ReblockingAfterUnblockWorks() public {
        vm.startPrank(ADMIN);
        voting.blockVoter(ALICE);
        voting.unblockVoter(ALICE);
        voting.blockVoter(ALICE);
        vm.stopPrank();

        assertEq(voting.getBlockedCount(), 1);
        assertEq(voting.getBlockedVoter(0), ALICE);
        assertTrue(voting.blocked(ALICE));
    }

    function test_UnblockingSomeoneNeverBlockedIsANoOp() public {
        vm.prank(ADMIN);
        voting.unblockVoter(ALICE);

        assertEq(voting.getBlockedCount(), 0);
        assertFalse(voting.blocked(ALICE));
    }

    function test_BlockedVoterRejectsBadIndex() public {
        vm.expectRevert(abi.encodeWithSelector(Voting.InvalidIndex.selector, 0));
        voting.getBlockedVoter(0);
    }

    /* ---------------------------------------------------------------- */
    /* Access control                                                   */
    /* ---------------------------------------------------------------- */

    function test_OnlyAdminCanBlock() public {
        vm.prank(MALLORY);
        vm.expectRevert(Voting.NotAdmin.selector);
        voting.blockVoter(ALICE);

        assertFalse(voting.blocked(ALICE));
    }

    /// The owner deploys the ballot but does not police it.
    function test_OwnerCannotBlockEither() public {
        vm.expectRevert(Voting.NotAdmin.selector);
        voting.blockVoter(ALICE);
    }

    function test_AdminCannotBlockTheOwner() public {
        vm.prank(ADMIN);
        vm.expectRevert(Voting.OwnerCannotBeBlocked.selector);
        voting.blockVoter(address(this));
    }

    function test_AdminCannotBlockItself() public {
        vm.prank(ADMIN);
        vm.expectRevert(Voting.AdminCannotBeBlocked.selector);
        voting.blockVoter(ADMIN);
    }

    function test_ZeroAddressCannotBeBlocked() public {
        vm.prank(ADMIN);
        vm.expectRevert(Voting.ZeroAddress.selector);
        voting.blockVoter(address(0));
    }

    function test_OnlyOwnerCanChangeTheAdmin() public {
        vm.prank(MALLORY);
        vm.expectRevert(Voting.NotOwner.selector);
        voting.setAdmin(MALLORY);

        // Not even the current admin may hand the role on.
        vm.prank(ADMIN);
        vm.expectRevert(Voting.NotOwner.selector);
        voting.setAdmin(MALLORY);

        assertEq(voting.admin(), ADMIN);
    }

    function test_OwnerCanReplaceTheAdmin() public {
        voting.setAdmin(CAROL);
        assertEq(voting.admin(), CAROL);

        // The old admin loses the privilege ...
        vm.prank(ADMIN);
        vm.expectRevert(Voting.NotAdmin.selector);
        voting.blockVoter(ALICE);

        // ... and the new one gains it.
        vm.prank(CAROL);
        voting.blockVoter(ALICE);
        assertTrue(voting.blocked(ALICE));
    }

    function test_AdminCannotBeSetToZero() public {
        vm.expectRevert(Voting.ZeroAddress.selector);
        voting.setAdmin(address(0));
    }

    /* ---------------------------------------------------------------- */
    /* Results                                                          */
    /* ---------------------------------------------------------------- */

    function test_GetResultsIsPrintable() public {
        assertEq(voting.getResults(), "Pizza: 0 | Pasta: 0 | Sushi: 0");

        vm.prank(ALICE);
        voting.vote(0);
        vm.prank(BOB);
        voting.vote(0);
        voting.vote(1); // the owner votes too

        assertEq(voting.getResults(), "Pizza: 2 | Pasta: 1 | Sushi: 0");
    }

    /// Exercises the multi-digit path of the uint -> string helper.
    function test_GetResultsHandlesMultiDigitCounts() public {
        for (uint160 i = 1; i <= 12; i++) {
            vm.prank(address(i));
            voting.vote(0);
        }
        assertEq(voting.getVotes(0), 12);
        assertEq(voting.getResults(), "Pizza: 12 | Pasta: 0 | Sushi: 0");
    }

    function test_GetTopicRejectsBadIndex() public {
        vm.expectRevert(abi.encodeWithSelector(Voting.InvalidTopic.selector, 9));
        voting.getTopic(9);
    }

    function test_GetVotesRejectsBadIndex() public {
        vm.expectRevert(abi.encodeWithSelector(Voting.InvalidTopic.selector, 9));
        voting.getVotes(9);
    }

    /* ---------------------------------------------------------------- */
    /* The exact sequence the demo will run on Hedera                   */
    /* ---------------------------------------------------------------- */

    function test_FullDemoSequence() public {
        address operator = address(this);
        address voter1 = ALICE;
        address voter2 = BOB;
        address voter3 = MALLORY;

        // 1. the admin - not the owner - blocks voter3
        vm.prank(ADMIN);
        voting.blockVoter(voter3);
        assertEq(voting.getBlockedCount(), 1);
        assertEq(voting.getBlockedVoter(0), voter3);

        // 2. three successful votes
        voting.vote(0); // operator  -> Pizza
        vm.prank(voter1);
        voting.vote(0); // voter1    -> Pizza
        vm.prank(voter2);
        voting.vote(1); // voter2    -> Pasta

        // 3. voter3 is blocked
        vm.prank(voter3);
        vm.expectRevert(Voting.AccountBlocked.selector);
        voting.vote(2);

        // 4. voter1 already voted
        vm.prank(voter1);
        vm.expectRevert(Voting.AlreadyVoted.selector);
        voting.vote(1);

        // 5. voter2 is not the admin
        vm.prank(voter2);
        vm.expectRevert(Voting.NotAdmin.selector);
        voting.blockVoter(voter1);

        // 6. final tally
        assertEq(voting.getResults(), "Pizza: 2 | Pasta: 1 | Sushi: 0");
        assertEq(voting.totalVotes(), 3);
        assertTrue(voting.hasVoted(operator));
        assertFalse(voting.hasVoted(voter3));
    }
}
